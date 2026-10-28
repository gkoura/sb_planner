import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const modules = {
    "next/cache": `export function revalidatePath() {}`,
    "@/lib/auth-guard": `export async function requireAdmin() { return { user: { id: 'admin' } }; }`,
    "@/lib/prisma": `export const prisma = { $transaction: (fn) => fn(globalThis.__restoreTest.transaction) };`,
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
const state = (globalThis.__restoreTest = {});
const { restoreScheduleRun } = await import("../src/app/actions/schedules.ts");

function setup({ year = 2999, published = false } = {}) {
    const members = ["A", "B", "T"].map((id) => ({
        id,
        name: id,
        mode: "UNAVAILABLE",
        dates: [],
        participationMode: id === "T" ? "TRAINEE" : "NORMAL",
        shadowDayCount: id === "T" ? 1 : 0,
    }));
    const dates = Array.from({ length: 28 }, (_, i) => ({
        date: `${year}-02-${String(i + 1).padStart(2, "0")}`,
        planningMemberId: i % 2 ? "B" : "A",
        nameSnapshot: i % 2 ? "B saved" : "A saved",
        roleSnapshot: "ENGINEER",
        shadows: [],
    }));
    const source = {
        id: "source",
        planningMonthId: "month",
        version: 1,
        algorithmVersion: "csv-import-v1",
        inputSnapshot: JSON.stringify({
            year,
            month: 2,
            source: "CSV_IMPORT",
            members: members.map((m) =>
                m.id === "A"
                    ? {
                          ...m,
                          availabilitySubmitted: false,
                          dates: [dates[0].date],
                      }
                    : m,
            ),
        }),
        assignments: structuredClone(dates),
    };
    const current = {
        id: "current",
        planningMonthId: "month",
        version: 2,
        algorithmVersion: "v3-shadow-feasibility",
        inputSnapshot: JSON.stringify({
            year,
            month: 2,
            members: members.map((m) =>
                m.id === "A"
                    ? {
                          ...m,
                          availabilitySubmitted: true,
                          dates: [dates[0].date],
                      }
                    : m,
            ),
        }),
        assignments: structuredClone(dates),
    };
    source.assignments[0].shadows = [
        {
            kind: "TRAINING",
            shadowMemberId: "T",
            nameSnapshot: "T saved",
            roleSnapshot: "ENGINEER",
        },
    ];
    state.created = null;
    state.source = source;
    state.current = current;
    state.transaction = {
        scheduleRun: {
            async findUnique() {
                return state.source;
            },
            async findFirst() {
                return state.current;
            },
            async aggregate() {
                return { _max: { version: 2 } };
            },
            async create({ data }) {
                state.created = data;
                return { id: "revision" };
            },
        },
        planningMonth: {
            async findUnique() {
                return {
                    id: "month",
                    year,
                    month: 2,
                    status: published ? "PUBLISHED" : "GENERATED",
                };
            },
        },
        planningMember: {
            async findMany() {
                return members.map(({ id }) => ({
                    id,
                    nameSnapshot: `${id} current`,
                    roleSnapshot: "ADMIN",
                }));
            },
        },
    };
}
function form(allowPastChanges = false) {
    const data = new FormData();
    data.set("sourceRunId", "source");
    data.set("revisionReason", "Restore previous version");
    if (allowPastChanges) data.set("allowPastChanges", "true");
    return data;
}

test("restores a shadow-only change using the source snapshot and provenance", async () => {
    setup();
    const result = await restoreScheduleRun({}, form());
    assert.match(result.success, /new candidate/);
    assert.equal(state.created.inputSnapshot, state.source.inputSnapshot);
    assert.equal(state.created.algorithmVersion, "csv-import-v1");
    assert.equal(state.created.basedOnRunId, "current");
    assert.equal(state.created.version, 3);
    assert.equal(state.created.validationWarnings, null);
    assert.equal(state.created.assignments.create[0].nameSnapshot, "A saved");
    assert.deepEqual(state.created.assignments.create[0].shadows.create, [
        {
            kind: "TRAINING",
            shadowMemberId: "T",
            nameSnapshot: "T saved",
            roleSnapshot: "ENGINEER",
        },
    ]);
});

test("unchanged primary and shadow assignments do not create a revision", async () => {
    setup();
    state.current.assignments = structuredClone(state.source.assignments);
    state.current.inputSnapshot = state.source.inputSnapshot;
    state.current.algorithmVersion = state.source.algorithmVersion;
    const result = await restoreScheduleRun({}, form());
    assert.match(result.error, /already matches/);
    assert.equal(state.created, null);
});

test("restores different source inputs even when assignments match", async () => {
    setup();
    state.current.assignments = structuredClone(state.source.assignments);
    const result = await restoreScheduleRun({}, form());
    assert.match(result.success, /new candidate/);
    assert.equal(state.created.inputSnapshot, state.source.inputSnapshot);
    assert.equal(state.created.algorithmVersion, state.source.algorithmVersion);
});

test("past shadow-only changes require explicit correction approval", async () => {
    setup({ year: 2001, published: true });
    let result = await restoreScheduleRun({}, form());
    assert.match(result.error, /past shadow pairings/);
    assert.equal(state.created, null);
    result = await restoreScheduleRun({}, form(true));
    assert.match(result.success, /new published version/);
    assert.ok(state.created.publishedAt instanceof Date);
});

test("restore rejects an invalid source snapshot even if the current snapshot is valid", async () => {
    setup();
    state.source.inputSnapshot = "invalid";
    const result = await restoreScheduleRun({}, form());
    assert.match(result.error, /snapshot is invalid/);
    assert.equal(state.created, null);
});

test("past primary changes require explicit correction approval", async () => {
    setup({ year: 2001, published: true });
    state.current.assignments[1].planningMemberId = "A";
    const result = await restoreScheduleRun({}, form());
    assert.match(result.error, /changes past dates/);
    assert.equal(state.created, null);
});
