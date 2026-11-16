import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
const modules = {
    "next/cache": `export function revalidatePath() {}`,
    "@/lib/auth-guard": `export async function getCurrentSession() { return globalThis.__importTest.session; }`,
    "@/lib/prisma": `export const prisma = globalThis.__importTest.prisma;`,
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
        if (specifier === "./call-outs")
            return nextResolve(
                new URL("../src/lib/call-outs.ts", import.meta.url).href,
                context,
            );
        return nextResolve(specifier, context);
    },
});
const rows = new Map();
let scheduleAvailable = true;
const state = (globalThis.__importTest = {
    session: { user: { id: "first" } },
    prisma: {
        planningMonth: {
            async findMany() {
                return scheduleAvailable
                    ? [
                          {
                              scheduleRuns: [
                                  {
                                      assignments: [
                                          {
                                              date: "2026-10-21",
                                              planningMember: {
                                                  userId: state.session.user.id,
                                              },
                                              shadows: [],
                                          },
                                      ],
                                  },
                              ],
                          },
                      ]
                    : [];
            },
        },
        callOut: {
            async findMany({ where }) {
                if (where.id)
                    return [...rows.values()].filter((row) =>
                        where.id.in.includes(row.id),
                    );
                return [...rows.values()].filter(
                    (row) => row.userId === where.userId,
                );
            },
            async createMany({ data }) {
                let count = 0;
                for (const row of data) {
                    if (!rows.has(row.id)) {
                        rows.set(row.id, row);
                        count++;
                    }
                }
                return { count };
            },
        },
    },
});
const { validateCallOutImport, CALL_OUT_IMPORT_TEMPLATE } =
    await import("../src/lib/call-out-import.ts");
const { importCallOuts, previewCallOutImport } =
    await import("../src/app/actions/call-out-import.ts");
const csv =
    'reason,duty_role,start_athens,end_athens\n"Alarm, server",primary,2026-10-21T23:00,2026-10-22T01:30';

test("validates quoted fields and previews split calendar days", () => {
    const result = validateCallOutImport(csv);
    assert.deepEqual(result.errors, []);
    assert.equal(result.entries[0].reason, "Alarm, server");
    assert.deepEqual(
        result.entries[0].days.map((day) => day.roundedHours),
        [1, 2],
    );
});
test("blocks malformed, duplicate and invalid rows", () => {
    for (const invalid of [
        csv + '\n"bad',
        csv + '\n"Alarm, server",primary,2026-10-21T23:00,2026-10-22T01:30',
        csv.replace("2026-10-22T01:30", "2026-10-21T21:00"),
        csv.replace("primary", "other"),
    ])
        assert.ok(validateCallOutImport(invalid).errors.length);
});
test("imports are user-scoped and repeated files skip existing records", async () => {
    assert.deepEqual(await importCallOuts(csv), { imported: 1, skipped: 0 });
    assert.deepEqual(await importCallOuts(csv), { imported: 0, skipped: 1 });
    state.session = { user: { id: "second" } };
    assert.deepEqual(await importCallOuts(csv), { imported: 1, skipped: 0 });
    state.session = null;
    assert.deepEqual(await importCallOuts(csv), {
        error: "Please sign in again.",
    });
});

test("template contains valid example rows and preview requires a session", async () => {
    const sample = validateCallOutImport(CALL_OUT_IMPORT_TEMPLATE);
    assert.equal(sample.entries.length, 2);
    assert.deepEqual(sample.errors, []);
    assert.equal(sample.entries[0].dutyDate, "2026-10-21");
    assert.equal(sample.entries[1].dutyDate, null);
    state.session = null;
    assert.deepEqual(await previewCallOutImport(csv), {
        errors: ["Please sign in again."],
        entries: [],
    });
    state.session = { user: { id: "first" } };
    assert.equal((await previewCallOutImport(csv)).entries.length, 1);
});

test("an edited imported record does not block importing its original data", async () => {
    rows.clear();
    state.session = { user: { id: "first" } };
    assert.deepEqual(await importCallOuts(csv), { imported: 1, skipped: 0 });
    [...rows.values()][0].reason = "Changed incident";
    assert.deepEqual(await importCallOuts(csv), { imported: 1, skipped: 0 });
    assert.deepEqual(await importCallOuts(csv), { imported: 0, skipped: 1 });
});

test("preview and import reject unscheduled duties, while support needs no schedule", async () => {
    state.session = { user: { id: "first" } };
    assert.deepEqual((await previewCallOutImport(csv)).errors, []);
    const support = csv.replace("primary", "SUPPORT");
    const count = rows.size;
    assert.match(
        (await previewCallOutImport(support)).errors[0],
        /scheduled role instead of support/,
    );
    assert.match(
        (await importCallOuts(support)).error,
        /scheduled role instead of support/,
    );
    assert.equal(rows.size, count);
    scheduleAvailable = false;
    assert.match(
        (await previewCallOutImport(csv)).errors[0],
        /no published duty/,
    );
    assert.match((await importCallOuts(csv)).error, /no published duty/);
    assert.equal(rows.size, count);
    assert.deepEqual((await previewCallOutImport(support)).errors, []);
    assert.deepEqual(await importCallOuts(support), {
        imported: 1,
        skipped: 0,
    });
    scheduleAvailable = true;
});

test("overtime imports without a standby date, with or without scheduled duty", async () => {
    rows.clear();
    state.session = { user: { id: "first" } };
    const overtime = csv.replace("primary", "overtime");
    for (const available of [true, false]) {
        scheduleAvailable = available;
        const preview = await previewCallOutImport(overtime);
        assert.deepEqual(preview.errors, []);
        assert.equal(preview.entries[0].role, "OVERTIME");
        assert.equal(preview.entries[0].dutyDate, null);
    }
    assert.deepEqual(await importCallOuts(overtime), {
        imported: 1,
        skipped: 0,
    });
    assert.equal([...rows.values()][0].dutyDate, null);
    assert.deepEqual(await importCallOuts(overtime), {
        imported: 0,
        skipped: 1,
    });
    scheduleAvailable = true;
});
