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
    state.run = run;
    state.members = members;
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

function manualForm(
    shadows,
    { allowPastChanges = false, changePrimary = false } = {},
) {
    const assignments = state.run.assignments.map(
        ({ date, planningMemberId }) => ({ date, planningMemberId }),
    );
    if (changePrimary)
        [assignments[19].planningMemberId, assignments[20].planningMemberId] = [
            assignments[20].planningMemberId,
            assignments[19].planningMemberId,
        ];
    const data = form(assignments, allowPastChanges);
    data.set("shadows", JSON.stringify(shadows));
    return data;
}
function traineeMoveSetup() {
    setup({ trainee: true });
    const trainee = state.members.find((member) => member.id === "T");
    trainee.dates = ["2026-02-01", "2026-02-20", "2026-02-22"];
    state.run.inputSnapshot = JSON.stringify({
        year: 2026,
        month: 2,
        members: state.members,
    });
    state.run.assignments[19].shadows = [
        { kind: "TRAINING", shadowMemberId: "T" },
    ];
}

test("a shadow-only edit saves the selected training date without regenerating pairings", async () => {
    traineeMoveSetup();
    const result = await saveScheduleEdit(
        {},
        manualForm([
            { date: "2026-02-22", kind: "TRAINING", shadowMemberId: "T" },
        ]),
    );
    assert.match(result.success, /new official schedule/);
    assert.equal(state.created.basedOnRunId, "run");
    assert.deepEqual(state.created.assignments.create[19].shadows.create, []);
    assert.deepEqual(state.created.assignments.create[21].shadows.create, [
        {
            kind: "TRAINING",
            shadowMemberId: "T",
            nameSnapshot: "T",
            roleSnapshot: "ENGINEER",
        },
    ]);
    assert.equal(state.run.assignments[19].shadows[0].shadowMemberId, "T");
    assert.equal(state.created.inputSnapshot, state.run.inputSnapshot);
});

test("manual mentoring changes preserve every other pair", async () => {
    setup();
    state.members[0].participationMode = "MENTORED";
    state.members.push({
        id: "E",
        name: "E",
        mode: "UNAVAILABLE",
        dates: [],
        participationMode: "NORMAL",
    });
    state.run.inputSnapshot = JSON.stringify({
        year: 2026,
        month: 2,
        members: state.members,
    });
    const shadows = [];
    for (const assignment of state.run.assignments) {
        if (assignment.planningMemberId === "A") {
            assignment.shadows = [{ kind: "MENTORING", shadowMemberId: "C" }];
            shadows.push({
                date: assignment.date,
                kind: "MENTORING",
                shadowMemberId: assignment.date === "2026-02-17" ? "E" : "C",
            });
        }
    }
    const result = await saveScheduleEdit({}, manualForm(shadows));
    assert.ok(result.success, result.error);
    assert.equal(
        state.created.assignments.create[16].shadows.create[0].shadowMemberId,
        "E",
    );
    assert.equal(
        state.created.assignments.create[0].shadows.create[0].shadowMemberId,
        "C",
    );
});

test("explicit past shadow changes require the override and a published change reason", async () => {
    traineeMoveSetup();
    const shadows = [
        { date: "2026-02-01", kind: "TRAINING", shadowMemberId: "T" },
    ];
    const blocked = await saveScheduleEdit({}, manualForm(shadows));
    assert.match(blocked.error, /changes past shadow pairings/);
    assert.equal(state.created, null);
    const noReason = manualForm(shadows, { allowPastChanges: true });
    noReason.set("revisionReason", "");
    assert.match((await saveScheduleEdit({}, noReason)).error, /short reason/);
    assert.ok(
        (
            await saveScheduleEdit(
                {},
                manualForm(shadows, { allowPastChanges: true }),
            )
        ).success,
    );
});

test("manual shadow edits reject malformed data, unknown participants, unavailable dates, counts and duplicate pairs", async () => {
    for (const shadows of [
        [{ date: "2026-02-22", shadowMemberId: "T", kind: "invalid" }],
        [{ date: "2026-02-22", shadowMemberId: "outsider", kind: "TRAINING" }],
        [{ date: "2026-02-21", shadowMemberId: "T", kind: "TRAINING" }],
        [],
        [
            { date: "2026-02-22", shadowMemberId: "T", kind: "TRAINING" },
            { date: "2026-02-22", shadowMemberId: "T", kind: "TRAINING" },
        ],
    ]) {
        traineeMoveSetup();
        const result = await saveScheduleEdit({}, manualForm(shadows));
        assert.ok(result.error, JSON.stringify(shadows));
        assert.equal(state.created, null);
    }
});

test("primary-only edits submitted with explicit shadows retain exactly the previewed pairings", async () => {
    traineeMoveSetup();
    const result = await saveScheduleEdit(
        {},
        manualForm(
            [{ date: "2026-02-20", shadowMemberId: "T", kind: "TRAINING" }],
            { changePrimary: true },
        ),
    );
    assert.ok(result.success, result.error);
    assert.equal(
        state.created.assignments.create[19].shadows.create[0].shadowMemberId,
        "T",
    );
});

test("candidate shadow-only edits save without a reason and unchanged pairings are rejected as no-ops", async () => {
    traineeMoveSetup();
    state.run.planningMonth.status = "GENERATED";
    state.run.publishedAt = null;
    const data = manualForm([
        { date: "2026-02-22", shadowMemberId: "T", kind: "TRAINING" },
    ]);
    data.set("revisionReason", "");
    assert.match((await saveScheduleEdit({}, data)).success, /candidate edits/);
    traineeMoveSetup();
    const unchanged = manualForm([
        { date: "2026-02-20", shadowMemberId: "T", kind: "TRAINING" },
    ]);
    assert.match(
        (await saveScheduleEdit({}, unchanged)).error,
        /at least one assignment change/,
    );
    assert.equal(state.created, null);
    state.run.version = 0;
    assert.match((await saveScheduleEdit({}, data)).error, /no longer current/);
    assert.equal(state.created, null);
});
