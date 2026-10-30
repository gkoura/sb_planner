import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const editsUrl = new URL("../src/lib/schedule-edits.ts", import.meta.url).href;
const modules = {
    "next/cache": `export function revalidatePath() {}`,
    "@/lib/auth-guard": `export async function requireAdmin() { return { user: { id: 'admin' } }; }`,
    "@/lib/prisma": `export const prisma = { $transaction: (fn) => fn(globalThis.__editActionTest.transaction) };`,
    "@/lib/schedule-edits": `export * from ${JSON.stringify(editsUrl)}; export function getOperationalDate() { return '2026-02-15'; }`,
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
const state = (globalThis.__editActionTest = {});
const { saveScheduleEdit } = await import("../src/app/actions/schedules.ts");

function setup({ trainee = false, oldShadow = null } = {}) {
    const members = ["A", "B", "C", "D"].map((id) => ({
        id,
        name: id,
        mode: "UNAVAILABLE",
        dates: [],
        participationMode: "NORMAL",
    }));
    if (trainee)
        members.push({
            id: "T",
            name: "T",
            mode: "AVAILABLE",
            dates: ["2026-02-01"],
            participationMode: "TRAINEE",
            shadowDayCount: 1,
        });
    const assignments = Array.from({ length: 28 }, (_, index) => ({
        date: `2026-02-${String(index + 1).padStart(2, "0")}`,
        planningMemberId: "ABCD"[index % 4],
        shadows: index === 0 && oldShadow ? [oldShadow] : [],
    }));
    const run = {
        id: "run",
        planningMonthId: "month",
        version: 1,
        algorithmVersion: "test",
        publishedAt: new Date(),
        planningMonth: { year: 2026, month: 2, status: "PUBLISHED" },
        inputSnapshot: JSON.stringify({ year: 2026, month: 2, members }),
        assignments,
    };
    state.created = null;
    state.transaction = {
        async $executeRaw() {},
        async $queryRaw() {
            return [];
        },
        scheduleRun: {
            async findUnique() {
                return run;
            },
            async aggregate() {
                return { _max: { version: 1 } };
            },
            async create({ data }) {
                state.created = data;
                return { id: "revision" };
            },
        },
        planningMember: {
            async findMany() {
                return members.map(({ id }) => ({
                    id,
                    nameSnapshot: id,
                    roleSnapshot: "ENGINEER",
                }));
            },
        },
    };
    const edited = assignments.map(({ date, planningMemberId }) => ({
        date,
        planningMemberId,
    }));
    [edited[19].planningMemberId, edited[20].planningMemberId] = [
        edited[20].planningMemberId,
        edited[19].planningMemberId,
    ];
    return edited;
}

function form(assignments, allowPastChanges = false) {
    const data = new FormData();
    data.set("scheduleRunId", "run");
    data.set("assignments", JSON.stringify(assignments));
    data.set("revisionReason", "Future correction");
    if (allowPastChanges) data.set("allowPastChanges", "true");
    return data;
}

test("future-only published edits allow unchanged past dates without shadows", async () => {
    const result = await saveScheduleEdit({}, form(setup()));
    assert.match(result.success, /new official schedule/);
    assert.ok(state.created);
});

test("future-only published edits allow unchanged past shadow pairs", async () => {
    const result = await saveScheduleEdit(
        {},
        form(
            setup({
                trainee: true,
                oldShadow: { kind: "TRAINING", shadowMemberId: "T" },
            }),
        ),
    );
    assert.match(result.success, /new official schedule/);
});

test("past shadow additions, removals and changes require the correction override", async () => {
    for (const options of [
        { trainee: true },
        { oldShadow: { kind: "TRAINING", shadowMemberId: "T" } },
        {
            trainee: true,
            oldShadow: { kind: "MENTORING", shadowMemberId: "T" },
        },
    ]) {
        const assignments = setup(options);
        const blocked = await saveScheduleEdit({}, form(assignments));
        assert.match(blocked.error, /changes past shadow pairings/);
        assert.equal(state.created, null);
        const allowed = await saveScheduleEdit({}, form(assignments, true));
        assert.match(allowed.success, /new official schedule/);
    }
});

test("past primary changes still require the correction override", async () => {
    const assignments = setup();
    assignments[0].planningMemberId = "B";
    const result = await saveScheduleEdit({}, form(assignments));
    assert.match(result.error, /Past published dates are locked/);
    assert.equal(state.created, null);
});
