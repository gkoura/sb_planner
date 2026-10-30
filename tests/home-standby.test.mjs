import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === "@/lib/prisma")
            return {
                url: `data:text/javascript,export const prisma = globalThis.__homeStandby.prisma;`,
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
const { getTodayInAthens } = await import("../src/lib/home/dates.ts");
const { dutyDate } = await import("../src/lib/call-outs.ts");
const queries = [];
let missingMonth = "";
const months = new Map();
function month(date, name) {
    const key = date.slice(0, 7);
    const existing = months.get(key);
    const assignment = {
        date,
        nameSnapshot: name,
        planningMemberId: "member",
        shadows: [],
        planningMember: { user: { phoneNumber: "+306900000000" } },
    };
    if (existing) existing.scheduleRuns[0].assignments.push(assignment);
    else
        months.set(key, {
            id: key,
            year: Number(key.slice(0, 4)),
            month: Number(key.slice(5)),
            members: [{ id: "member", userId: "user" }],
            scheduleRuns: [{ assignments: [assignment] }],
        });
}
month("2026-10-30", "Previous duty");
month("2026-10-31", "October duty");
month("2026-11-01", "November duty");
month("2026-12-31", "Year-end duty");
month("2027-01-01", "New-year duty");
globalThis.__homeStandby = {
    prisma: {
        planningMonth: {
            async findFirst(query) {
                queries.push(query);
                const key = `${query.where.year}-${String(query.where.month).padStart(2, "0")}`;
                assert.equal(query.where.status, "PUBLISHED");
                assert.equal(query.include.scheduleRuns.take, 1);
                assert.deepEqual(query.include.scheduleRuns.orderBy, [
                    { publishedAt: "desc" },
                    { version: "desc" },
                ]);
                return key === missingMonth ? null : (months.get(key) ?? null);
            },
            async findMany() {
                return [];
            },
        },
        planningMember: {
            async findMany() {
                return [];
            },
        },
        user: {
            async count() {
                return 1;
            },
        },
    },
};

const { getHomeData } = await import("../src/lib/home/queries.ts");

test("Athens duty dates switch at 09:00 in winter and summer, including DST weekends", () => {
    for (const [instant, expected] of [
        ["2026-10-31T06:59:59Z", "2026-10-30"],
        ["2026-10-31T07:00:00Z", "2026-10-31"],
        ["2026-07-15T05:59:59Z", "2026-07-14"],
        ["2026-07-15T06:00:00Z", "2026-07-15"],
        ["2026-03-29T05:59:59Z", "2026-03-28"],
        ["2026-03-29T06:00:00Z", "2026-03-29"],
        ["2026-10-25T06:59:59Z", "2026-10-24"],
        ["2026-10-25T07:00:00Z", "2026-10-25"],
    ])
        assert.equal(dutyDate(new Date(instant)), expected);
});

test("current standby uses the active duty month while personal reports use the calendar month", async () => {
    for (const role of ["ENGINEER", "ADMIN"])
        for (const [instant, name, schedule, calendarMonth, queryCount] of [
            ["2026-10-31T06:59:59Z", "Previous duty", "2026-10", 10, 1],
            ["2026-10-31T07:00:00Z", "October duty", "2026-10", 10, 1],
            ["2026-10-31T22:30:00Z", "October duty", "2026-10", 11, 2],
            ["2026-11-01T07:00:00Z", "November duty", "2026-11", 11, 1],
            ["2027-01-01T06:59:59Z", "Year-end duty", "2026-12", 1, 2],
            ["2027-01-01T07:00:00Z", "New-year duty", "2027-01", 1, 1],
        ]) {
            queries.length = 0;
            const now = new Date(instant);
            const data = await getHomeData(
                { id: "user", name: "User", role },
                getTodayInAthens(now),
                dutyDate(now),
            );
            assert.equal(data.todayAssignment.name, name);
            assert.equal(data.todayAssignment.planningMonthId, schedule);
            assert.equal(data.personalSchedule.month, calendarMonth);
            assert.equal(queries.length, queryCount);
        }
});

test("missing duty-month publication never falls back to the calendar-month assignee", async () => {
    missingMonth = "2026-10";
    const now = new Date("2026-11-01T06:00:00Z");
    const data = await getHomeData(
        { id: "user", name: "User", role: "ENGINEER" },
        getTodayInAthens(now),
        dutyDate(now),
    );
    assert.equal(data.todayAssignment, null);
    assert.equal(data.personalSchedule.month, 11);
    missingMonth = "";
});
