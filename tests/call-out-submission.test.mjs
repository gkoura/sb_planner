import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const modules = {
    "next/navigation": `export function redirect(to) { throw new Error('redirect:' + to); }`,
    "next/cache": `export function revalidatePath() {}`,
    "@/lib/auth-guard": `export async function getCurrentSession() { return globalThis.__callOutTest.session; }`,
    "@/lib/prisma": `export const prisma = globalThis.__callOutTest.prisma;`,
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
                new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url)
                    .href,
                context,
            );
        return nextResolve(specifier, context);
    },
});
const rows = new Map();
const assignment = (date = "2026-10-21", userId = "user", shadows = []) => ({
    date,
    planningMember: { userId },
    shadows,
});
let scheduled = [assignment()];
let scheduleQuery;
const state = (globalThis.__callOutTest = {
    session: { user: { id: "user" } },
    prisma: {
        planningMonth: {
            async findMany(query) {
                scheduleQuery = query;
                return [{ scheduleRuns: [{ assignments: scheduled }] }];
            },
        },
        callOut: {
            async createMany({ data, skipDuplicates }) {
                assert.equal(skipDuplicates, true);
                if (!rows.has(data.id)) rows.set(data.id, data);
            },
            async updateMany({ where, data }) {
                const row = rows.get(where.id);
                if (!row || row.userId !== where.userId) return { count: 0 };
                rows.set(where.id, { ...row, ...data });
                return { count: 1 };
            },
            async findFirst({ where }) {
                const row = rows.get(where.id);
                return row?.userId === where.userId ? row : null;
            },
        },
    },
});
const { createCallOut, updateCallOut } =
    await import("../src/app/actions/call-outs.ts");
function form(id) {
    const data = new FormData();
    for (const [key, value] of Object.entries({
        submissionId: id,
        reason: "Incident",
        role: "PRIMARY",
        start: "2026-10-21T23:00",
        end: "2026-10-22T01:30",
    }))
        data.set(key, value);
    return data;
}

test("repeated submissions create one record; a new form can create another", async () => {
    rows.clear();
    state.session = { user: { id: "user" } };
    const id = "11111111-1111-4111-8111-111111111111";
    const results = await Promise.allSettled([
        createCallOut({}, form(id)),
        createCallOut({}, form(id)),
    ]);
    assert.ok(
        results.every(
            (result) =>
                result.status === "rejected" &&
                result.reason.message === "redirect:/call-outs?saved=1",
        ),
    );
    assert.equal(rows.size, 1);
    await assert.rejects(
        createCallOut({}, form("22222222-2222-4222-8222-222222222222")),
        /redirect:\/call-outs\?saved=1/,
    );
    assert.equal(rows.size, 2);
});

test("a submission identifier belonging to another user cannot be reused", async () => {
    state.session = { user: { id: "other" } };
    const data = form("11111111-1111-4111-8111-111111111111");
    data.set("role", "SUPPORT");
    await assert.rejects(createCallOut({}, data), /Unable to save/);
    assert.equal(rows.size, 2);
});

test("creation checks the derived duty date and published schedule query", async () => {
    state.session = { user: { id: "user" } };
    scheduled = [assignment("2026-10-29")];
    const data = form("33333333-3333-4333-8333-333333333333");
    data.set("start", "2026-10-30T00:30");
    data.set("end", "2026-10-30T01:30");
    await assert.rejects(
        createCallOut({}, data),
        /redirect:\/call-outs\?saved=1/,
    );
    assert.equal(rows.get(data.get("submissionId")).dutyDate, "2026-10-29");
    assert.deepEqual(scheduleQuery.where, {
        status: "PUBLISHED",
        OR: [{ year: 2026, month: 10 }],
    });
    const runs = scheduleQuery.select.scheduleRuns;
    assert.deepEqual(runs.where, { publishedAt: { not: null } });
    assert.deepEqual(runs.orderBy, [
        { publishedAt: "desc" },
        { version: "desc" },
    ]);
    assert.equal(runs.take, 1);
    assert.deepEqual(runs.select.assignments.where.date.in, ["2026-10-29"]);
    scheduled = [];
    const missing = form("44444444-4444-4444-8444-444444444444");
    assert.match(
        (await createCallOut({}, missing)).error,
        /no published duty exists/,
    );
    assert.equal(rows.has(missing.get("submissionId")), false);
});

test("duty validation matches each user's exact role and support needs no schedule", async () => {
    const startedAt = new Date("2026-10-29T21:30:00Z"); // 30/10 at 00:30 Athens
    const { validateCallOutDuties } =
        await import("../src/lib/call-out-duty.ts");
    scheduled = [
        assignment("2026-10-29", "primary", [
            { kind: "TRAINING", shadowMember: { userId: "trainee" } },
            { kind: "MENTORING", shadowMember: { userId: "mentor" } },
        ]),
    ];
    for (const [userId, role] of [
        ["primary", "PRIMARY"],
        ["trainee", "TRAINEE"],
        ["mentor", "MENTOR"],
    ]) {
        assert.deepEqual(
            await validateCallOutDuties(userId, [{ role, startedAt }]),
            [],
        );
        for (const other of ["PRIMARY", "TRAINEE", "MENTOR", "SUPPORT"].filter(
            (item) => item !== role,
        ))
            assert.equal(
                (
                    await validateCallOutDuties(userId, [
                        { role: other, startedAt },
                    ])
                ).length,
                1,
            );
    }
    scheduled = [];
    scheduleQuery = null;
    assert.deepEqual(
        await validateCallOutDuties("user", [{ role: "SUPPORT", startedAt }]),
        [],
    );
    assert.ok(scheduleQuery);
    state.session = { user: { id: "user" } };
    const data = form("55555555-5555-4555-8555-555555555555");
    data.set("role", "SUPPORT");
    await assert.rejects(
        createCallOut({}, data),
        /redirect:\/call-outs\?saved=1/,
    );
    assert.equal(rows.get(data.get("submissionId")).dutyDate, null);
});

test("edits cannot change a call-out to an unscheduled duty", async () => {
    state.session = { user: { id: "user" } };
    scheduled = [];
    const id = "11111111-1111-4111-8111-111111111111";
    const before = rows.get(id);
    const data = form(id);
    data.set("id", id);
    assert.match((await updateCallOut({}, data)).error, /no published duty/);
    assert.deepEqual(rows.get(id), before);
});

test("scheduled users cannot create or edit call-outs as support", async () => {
    state.session = { user: { id: "user" } };
    const data = form("66666666-6666-4666-8666-666666666666");
    data.set("role", "SUPPORT");
    for (const duty of [
        assignment(),
        assignment("2026-10-21", "other", [
            { kind: "TRAINING", shadowMember: { userId: "user" } },
        ]),
        assignment("2026-10-21", "other", [
            { kind: "MENTORING", shadowMember: { userId: "user" } },
        ]),
    ]) {
        scheduled = [duty];
        assert.match(
            (await createCallOut({}, data)).error,
            /scheduled role instead of support/,
        );
        assert.equal(rows.has(data.get("submissionId")), false);
        data.set("id", "11111111-1111-4111-8111-111111111111");
        assert.match(
            (await updateCallOut({}, data)).error,
            /scheduled role instead of support/,
        );
    }
});

test("edits validate and only update the owner's record", async () => {
    scheduled = [assignment()];
    const id = "11111111-1111-4111-8111-111111111111";
    const data = form(id);
    data.set("id", id);
    data.set("start", "2026-10-22T08:00");
    data.set("end", "2026-10-22T10:00");
    state.session = { user: { id: "other" } };
    assert.match((await updateCallOut({}, data)).error, /could not be found/);
    state.session = { user: { id: "user" } };
    data.set("end", "2026-10-22T07:00");
    assert.match((await updateCallOut({}, data)).error, /Check the reason/);
    data.set("end", "2026-10-22T10:00");
    await assert.rejects(
        updateCallOut({}, data),
        /redirect:\/call-outs\?saved=1/,
    );
    assert.equal(rows.get(id).dutyDate, "2026-10-21");
    assert.equal(
        rows.get(id).startedAt.toISOString(),
        "2026-10-22T05:00:00.000Z",
    );
});

test("overtime creation and edits are independent of published standby duties", async () => {
    state.session = { user: { id: "user" } };
    const id = "77777777-7777-4777-8777-777777777777";
    const data = form(id);
    data.set("role", "OVERTIME");
    for (const duties of [[assignment()], []]) {
        scheduled = duties;
        scheduleQuery = null;
        await assert.rejects(
            createCallOut({}, data),
            /redirect:\/call-outs\?saved=1/,
        );
        assert.equal(rows.get(id).role, "OVERTIME");
        assert.equal(rows.get(id).dutyDate, null);
        assert.equal(scheduleQuery, null);
    }
    // Changing a previously scheduled entry to overtime clears its duty date.
    const existingId = "11111111-1111-4111-8111-111111111111";
    assert.ok(rows.get(existingId).dutyDate);
    data.set("id", existingId);
    await assert.rejects(
        updateCallOut({}, data),
        /redirect:\/call-outs\?saved=1/,
    );
    assert.equal(rows.get(existingId).role, "OVERTIME");
    assert.equal(rows.get(existingId).dutyDate, null);
    state.session = { user: { id: "other" } };
    assert.match((await updateCallOut({}, data)).error, /could not be found/);
});

test("a rejected call-out can be corrected and retried with the same submission ID", async () => {
    state.session = { user: { id: "user" } };
    scheduled = [assignment("2026-10-21", "other")];
    const id = "88888888-8888-4888-8888-888888888888";
    const data = form(id);
    const failure = await createCallOut({}, data);
    assert.match(failure.error, /not scheduled as primary/);
    assert.equal(rows.has(id), false);

    data.set("role", "SUPPORT");
    await assert.rejects(
        createCallOut(failure, data),
        /redirect:\/call-outs\?saved=1/,
    );
    assert.equal(rows.get(id).reason, "Incident");
    assert.equal(rows.get(id).role, "SUPPORT");
});
