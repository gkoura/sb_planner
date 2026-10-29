import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.SB_TEST_DATABASE_URL;
if (!url)
    throw new Error(
        "SB_TEST_DATABASE_URL is required for the isolated integration database.",
    );
const parsed = new URL(url);
if (
    !["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname) ||
    parsed.pathname !== "/sb_planner_rel001_test"
) {
    throw new Error(
        "Integration tests require the local sb_planner_rel001_test database.",
    );
}
const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
});
globalThis.__monthIntegrationPrisma = prisma;
const modules = {
    "next/cache": `export function revalidatePath() {}`,
    "@/lib/auth-guard": `export async function requireAdmin() { return { user: { id: globalThis.__monthIntegrationAdmin } }; } export async function getCurrentSession() { return requireAdmin(); }`,
    "@/lib/prisma": `export const prisma = globalThis.__monthIntegrationPrisma;`,
};
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier in modules)
            return {
                url: `data:text/javascript,${encodeURIComponent(modules[specifier])}`,
                shortCircuit: true,
            };
        if (specifier.startsWith("@/"))
            return nextResolve(
                new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url)
                    .href,
                context,
            );
        return nextResolve(specifier, context);
    },
});
const { submitAvailabilityForMember } =
    await import("../../src/app/actions/availability.ts");
const { createScheduleRun } =
    await import("../../src/app/actions/schedules.ts");
const { deletePlanningMonth, savePlanningMonthRoster } =
    await import("../../src/app/actions/planning-months.ts");
after(async () => prisma.$disconnect());

async function fixture(ready) {
    let year;
    do {
        year = randomInt(2000, 9999);
    } while (
        await prisma.planningMonth.findUnique({
            where: { year_month: { year, month: 2 } },
        })
    );
    const tag = randomUUID();
    const adminId = `admin-${tag}`;
    globalThis.__monthIntegrationAdmin = adminId;
    const now = new Date();
    await prisma.user.create({
        data: {
            id: adminId,
            name: "Admin",
            email: `${tag}@example.com`,
            role: "ADMIN",
            createdAt: now,
            updatedAt: now,
        },
    });
    const month = await prisma.planningMonth.create({
        data: {
            year,
            month: 2,
            status: ready ? "READY" : "COLLECTING",
            createdBy: adminId,
        },
    });
    const members = [];
    for (let i = 0; i < 4; i++) {
        const id = `user-${tag}-${i}`;
        await prisma.user.create({
            data: {
                id,
                name: `Member ${i}`,
                email: `${tag}-${i}@example.com`,
                role: "ENGINEER",
                createdAt: now,
                updatedAt: now,
            },
        });
        const member = await prisma.planningMember.create({
            data: {
                planningMonthId: month.id,
                userId: id,
                nameSnapshot: `Member ${i}`,
                emailSnapshot: `${tag}-${i}@example.com`,
                roleSnapshot: "ENGINEER",
            },
        });
        members.push(member);
        if (ready || i < 2)
            await prisma.availabilitySubmission.create({
                data: {
                    planningMemberId: member.id,
                    mode: "UNAVAILABLE",
                    source: "SELF",
                },
            });
    }
    return { month, members };
}
function availabilityForm(monthId, memberId) {
    const data = new FormData();
    data.set("planningMonthId", monthId);
    data.set("planningMemberId", memberId);
    data.set("mode", "UNAVAILABLE");
    return data;
}
function monthForm(monthId) {
    const data = new FormData();
    data.set("planningMonthId", monthId);
    return data;
}

test("generation persists primary and shadow assignments in one transaction", async () => {
    const { month, members } = await fixture(true);
    await prisma.planningMember.update({
        where: { id: members[0].id },
        data: { participationMode: "MENTORED" },
    });
    const result = await createScheduleRun({}, monthForm(month.id));
    assert.ok(result.success, JSON.stringify(result));
    const saved = await prisma.planningMonth.findUniqueOrThrow({
        where: { id: month.id },
        include: {
            scheduleRuns: {
                include: { assignments: { include: { shadows: true } } },
            },
        },
    });
    assert.equal(saved.status, "GENERATED");
    assert.equal(saved.scheduleRuns.length, 1);
    assert.ok(
        saved.scheduleRuns[0].assignments.some(
            (assignment) => assignment.shadows.length > 0,
        ),
    );
    assert.ok(
        saved.scheduleRuns[0].assignments.every(
            (assignment) =>
                (assignment.planningMemberId === members[0].id) ===
                (assignment.shadows.length === 1),
        ),
    );
});

test("a failed assignment insert rolls back the run and month status", async () => {
    const { month } = await fixture(true);
    await prisma.$executeRawUnsafe(
        `ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "test_generation_rollback" CHECK ("nameSnapshot" <> 'Member 0') NOT VALID`,
    );
    try {
        await assert.rejects(createScheduleRun({}, monthForm(month.id)));
        const saved = await prisma.planningMonth.findUniqueOrThrow({
            where: { id: month.id },
            include: { scheduleRuns: true },
        });
        assert.equal(saved.status, "READY");
        assert.equal(saved.scheduleRuns.length, 0);
    } finally {
        await prisma.$executeRawUnsafe(
            `ALTER TABLE "ScheduleAssignment" DROP CONSTRAINT "test_generation_rollback"`,
        );
    }
});
async function holdMonth(monthId) {
    let acquired;
    const locked = new Promise((resolve) => {
        acquired = resolve;
    });
    let release;
    const proceed = new Promise((resolve) => {
        release = resolve;
    });
    const completion = prisma.$transaction(
        async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "PlanningMonth" WHERE "id" = ${monthId} FOR UPDATE`;
            acquired();
            await proceed;
        },
        { timeout: 10000 },
    );
    await locked;
    return { release, completion };
}
async function waitForBlockedLocks(count) {
    for (let i = 0; i < 100; i++) {
        const rows =
            await prisma.$queryRaw`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE%'`;
        if (rows[0].count >= count) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Timed out waiting for ${count} blocked month locks`);
}

test("revising availability replaces dates and retains the new selection", async () => {
    const { month, members } = await fixture(true);
    const form = availabilityForm(month.id, members[0].id);
    const first = `${month.year}-02-03`;
    const second = `${month.year}-02-05`;
    form.append("dates", first);
    assert.ok((await submitAvailabilityForMember({}, form)).success);
    let saved = await prisma.availabilitySubmission.findUniqueOrThrow({
        where: { planningMemberId: members[0].id },
        include: { dates: true },
    });
    assert.deepEqual(
        saved.dates.map(({ date }) => date),
        [first],
    );

    form.delete("dates");
    form.append("dates", second);
    assert.ok((await submitAvailabilityForMember({}, form)).success);
    saved = await prisma.availabilitySubmission.findUniqueOrThrow({
        where: { planningMemberId: members[0].id },
        include: { dates: true },
    });
    assert.deepEqual(
        saved.dates.map(({ date }) => date),
        [second],
    );
});

test("concurrent final submissions both persist and leave the month ready", async () => {
    const { month, members } = await fixture(false);
    const held = await holdMonth(month.id);
    const first = submitAvailabilityForMember(
        {},
        availabilityForm(month.id, members[2].id),
    );
    const second = submitAvailabilityForMember(
        {},
        availabilityForm(month.id, members[3].id),
    );
    try {
        await waitForBlockedLocks(2);
    } finally {
        held.release();
        await held.completion;
    }
    const results = await Promise.all([first, second]);
    assert.ok(
        results.every((result) => result.success),
        JSON.stringify(results),
    );
    const saved = await prisma.planningMonth.findUnique({
        where: { id: month.id },
        include: { members: { include: { availabilitySubmission: true } } },
    });
    assert.equal(saved.status, "READY");
    assert.equal(
        saved.members.filter((member) => member.availabilitySubmission).length,
        4,
    );
});

test("generation freezes availability before a queued late save", async () => {
    const { month, members } = await fixture(true);
    const held = await holdMonth(month.id);
    const generation = createScheduleRun({}, monthForm(month.id));
    await waitForBlockedLocks(1);
    const late = submitAvailabilityForMember(
        {},
        availabilityForm(month.id, members[0].id),
    );
    try {
        await waitForBlockedLocks(2);
    } finally {
        held.release();
        await held.completion;
    }
    const [generated, saved] = await Promise.all([generation, late]);
    assert.ok(generated.success, JSON.stringify(generated));
    assert.match(saved.error, /locked after schedule generation/);
    const result = await prisma.planningMonth.findUnique({
        where: { id: month.id },
        include: { scheduleRuns: true },
    });
    assert.equal(result.status, "GENERATED");
    assert.equal(result.scheduleRuns.length, 1);
});

test("deletion queued after generation cannot remove schedule history", async () => {
    const { month } = await fixture(true);
    const held = await holdMonth(month.id);
    const generation = createScheduleRun({}, monthForm(month.id));
    await waitForBlockedLocks(1);
    const deletion = deletePlanningMonth({}, monthForm(month.id));
    try {
        await waitForBlockedLocks(2);
    } finally {
        held.release();
        await held.completion;
    }
    const [generated, deleted] = await Promise.all([generation, deletion]);
    assert.ok(generated.success, JSON.stringify(generated));
    assert.match(deleted.error, /without schedule history/);
    const result = await prisma.planningMonth.findUnique({
        where: { id: month.id },
        include: { scheduleRuns: true },
    });
    assert.equal(result.status, "GENERATED");
    assert.equal(result.scheduleRuns.length, 1);
});

test("generation queued after deletion cannot create a schedule", async () => {
    const { month } = await fixture(true);
    const held = await holdMonth(month.id);
    const deletion = deletePlanningMonth({}, monthForm(month.id));
    await waitForBlockedLocks(1);
    const generation = createScheduleRun({}, monthForm(month.id));
    try {
        await waitForBlockedLocks(2);
    } finally {
        held.release();
        await held.completion;
    }
    const [deleted, generated] = await Promise.all([deletion, generation]);
    assert.equal(deleted.error, undefined);
    assert.match(generated.error, /not found/);
    assert.equal(
        await prisma.planningMonth.findUnique({ where: { id: month.id } }),
        null,
    );
    assert.equal(
        await prisma.scheduleRun.count({
            where: { planningMonthId: month.id },
        }),
        0,
    );
});

test("a long-held month lock returns an actionable retry message", async () => {
    const { month, members } = await fixture(false);
    const held = await holdMonth(month.id);
    try {
        const result = await submitAvailabilityForMember(
            {},
            availabilityForm(month.id, members[2].id),
        );
        assert.match(result.error, /busy or changed concurrently/);
    } finally {
        held.release();
        await held.completion;
    }
    const saved = await prisma.planningMonth.findUnique({
        where: { id: month.id },
    });
    assert.equal(saved.status, "COLLECTING");
});

test("promoting a roster member and saving keeps their availability", async () => {
    const { month, members } = await fixture(true);
    const original = await prisma.availabilitySubmission.findUnique({
        where: { planningMemberId: members[0].id },
    });
    await prisma.user.update({
        where: { id: members[0].userId },
        data: { role: "ADMIN" },
    });
    const form = new FormData();
    form.set("planningMonthId", month.id);
    form.set("rosterVersion", "2");
    for (const member of members) form.append("memberIds", member.userId);
    const result = await savePlanningMonthRoster({}, form);
    assert.ok(result.success, JSON.stringify(result));
    const retained = await prisma.planningMember.findUnique({
        where: { id: members[0].id },
        include: { availabilitySubmission: true },
    });
    assert.equal(retained.availabilitySubmission.id, original.id);
    assert.equal(retained.roleSnapshot, "ENGINEER");
    assert.equal(
        (await prisma.planningMonth.findUnique({ where: { id: month.id } }))
            .status,
        "READY",
    );
});
