import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DayPicker } from "react-day-picker";

const modules = {
    "next/cache": `export function revalidatePath() {}`,
    "@/lib/auth-guard": `export async function requireAdmin() { return { user: { id: 'admin' } }; } export async function getCurrentSession() { return null; }`,
    "@/lib/prisma": `export const prisma = globalThis.__calendarTestPrisma;`,
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
let saved;
let monthYear = 1;
const transaction = {
    async $executeRaw() {},
    async $queryRaw() {
        return [];
    },
    planningMonth: {
        async findUnique() {
            return {
                id: "month",
                year: monthYear,
                month: 2,
                status: "COLLECTING",
                members: [{ id: "member" }],
                scheduleRuns: [],
            };
        },
        async update() {},
    },
    scheduleRun: {
        async findUnique(args) {
            if (args.select) return { planningMonthId: "month" };
            return {
                id: "run",
                planningMonthId: "month",
                version: 1,
                publishedAt: null,
                planningMonth: { year: 4, month: 2, status: "GENERATED" },
                _count: { assignments: 29 },
            };
        },
        async aggregate() {
            return { _max: { version: 1 } };
        },
        async update() {},
    },
    planningMember: {
        async findFirst() {
            return { id: "member" };
        },
    },
    availabilitySubmission: {
        async upsert(data) {
            saved = data;
        },
        async count() {
            return 1;
        },
    },
};
globalThis.__calendarTestPrisma = {
    async $transaction(callback) {
        return callback(transaction);
    },
};
const {
    calendarDateValue,
    daysInCalendarMonth,
    localCalendarDate,
    utcCalendarDate,
} = await import("../src/lib/calendar-date.ts");
const { buildMonthWeeks } = await import("../src/lib/month-calendar.ts");
const { makeScheduleImportTemplate } =
    await import("../src/lib/schedule-import-template.ts");
const { validateScheduleCsvImport } =
    await import("../src/lib/schedule-import.ts");
const { submitAvailabilityForMember } =
    await import("../src/app/actions/availability.ts");
const { generateSchedule } = await import("../src/lib/scheduler.ts");
const { publishScheduleRun } = await import("../src/app/actions/schedules.ts");
const { formatMonth } = await import("../src/lib/home/dates.ts");

test("calendar date construction preserves early years, weekdays and leap rules", () => {
    for (const year of [1, 4, 99, 100, 400, 1900, 2000, 2026, 9999]) {
        assert.equal(localCalendarDate(year, 2, 1).getFullYear(), year);
        assert.equal(utcCalendarDate(year, 2, 1).getUTCFullYear(), year);
        assert.equal(
            daysInCalendarMonth(year, 2),
            [4, 400, 2000].includes(year) ? 29 : 28,
        );
        assert.equal(
            buildMonthWeeks(year, 2).flat().filter(Boolean).length,
            daysInCalendarMonth(year, 2),
        );
    }
    assert.equal(calendarDateValue(1, 1, 1), "0001-01-01");
    assert.equal(buildMonthWeeks(1, 1)[0][0].date, "0001-01-01");
    assert.equal(formatMonth(1, 1), "January 1");
});

test("availability date picker renders the correct early leap month", () => {
    const html = renderToStaticMarkup(
        React.createElement(DayPicker, {
            month: localCalendarDate(4, 2, 1),
            disableNavigation: true,
            showOutsideDays: false,
            dateLib: {
                newDate: (year, monthIndex, day) =>
                    localCalendarDate(year, monthIndex + 1, day),
            },
        }),
    );
    assert.match(html, /data-day="0004-02-29"/);
    assert.doesNotMatch(html, /data-day="1904-02-/);
});

test("CSV template and validation preserve early leap-year dates", () => {
    const lines = makeScheduleImportTemplate(4, 2).split("\r\n");
    assert.equal(lines.length, 30);
    assert.equal(lines[29], "0004-02-29,,,");
    const roster = ["A", "B"].map((id) => ({
        id,
        nameSnapshot: id,
        emailSnapshot: `${id.toLowerCase()}@example.com`,
        roleSnapshot: "ENGINEER",
        participationMode: "NORMAL",
        shadowDayCount: 0,
        availabilitySubmission: null,
    }));
    const csv = lines
        .map((line, index) =>
            index
                ? line.replace(",,,", `,${index % 2 ? "a" : "b"}@example.com,,`)
                : line,
        )
        .join("\n");
    const result = validateScheduleCsvImport(csv, 4, 2, roster);
    assert.equal(
        result.ok,
        true,
        result.ok ? undefined : result.errors.join("; "),
    );
    assert.equal(result.assignments.at(-1).date, "0004-02-29");
    const generated = generateSchedule(
        4,
        2,
        roster.map((member) => ({
            id: member.id,
            name: member.nameSnapshot,
            mode: "UNAVAILABLE",
            dates: [],
        })),
    );
    assert.equal(generated.ok, true);
    assert.equal(generated.assignments.length, 29);
});

test("availability action accepts padded early-year dates and rejects invalid leap days", async () => {
    const form = new FormData();
    form.set("planningMonthId", "month");
    form.set("planningMemberId", "member");
    form.set("mode", "UNAVAILABLE");
    form.set("dates", "0001-02-28");
    saved = undefined;
    monthYear = 1;
    let result = await submitAvailabilityForMember({}, form);
    assert.ok(result.success);
    assert.equal(saved.create.dates.create[0].date, "0001-02-28");
    form.set("dates", "0001-02-29");
    saved = undefined;
    result = await submitAvailabilityForMember({}, form);
    assert.match(result.error, /within the planning month/);
    assert.equal(saved, undefined);
    monthYear = 4;
    form.set("dates", "0004-02-29");
    result = await submitAvailabilityForMember({}, form);
    assert.ok(result.success);
    assert.equal(saved.create.dates.create[0].date, "0004-02-29");
});

test("publishing accepts all 29 days of an early leap-year February", async () => {
    const form = new FormData();
    form.set("scheduleRunId", "run");
    const result = await publishScheduleRun({}, form);
    assert.match(result.success, /published/);
});
