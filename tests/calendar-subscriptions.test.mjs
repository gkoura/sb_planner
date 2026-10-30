import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createHash } from "node:crypto";
import test from "node:test";

const modules = {
    "next/cache": `export function revalidatePath() {}`,
    "@/lib/auth-guard": `export async function getCurrentSession() { return globalThis.__calendarTest.session; }`,
    "@/lib/prisma": `export const prisma = globalThis.__calendarTest.prisma;`,
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
const state = (globalThis.__calendarTest = {
    session: { user: { id: "alice" } },
    rows: new Map(),
    months: [],
    query: null,
});
state.prisma = {
    calendarSubscription: {
        async upsert({ where, create, update }) {
            const key = `${where.userId_type.userId}:${where.userId_type.type}`;
            state.rows.set(key, { ...create, ...update });
        },
        async deleteMany({ where }) {
            state.rows.delete(`${where.userId}:${where.type}`);
        },
        async findUnique({ where }) {
            return (
                [...state.rows.values()].find(
                    (row) => row.tokenHash === where.tokenHash,
                ) ?? null
            );
        },
    },
    planningMonth: {
        async findMany(query) {
            state.query = query;
            return state.months;
        },
    },
};
const { renderCalendar } = await import("../src/lib/calendar-feed.ts");
const { manageCalendarSubscription } =
    await import("../src/app/actions/calendar-subscriptions.ts");
const { GET } = await import("../src/app/api/calendar/[token]/route.ts");
const assignment = (date, name, primary, shadows = []) => ({
    date,
    nameSnapshot: name,
    planningMember: { userId: primary },
    shadows,
});
const shadow = (userId, kind) => ({ kind, shadowMember: { userId } });
const months = [
    {
        id: "month1",
        scheduleRuns: [
            {
                publishedAt: new Date("2026-10-01T12:30:00Z"),
                assignments: [
                    assignment(
                        "2024-02-29",
                        "Alice, 名\\name;\n" + "é".repeat(40),
                        "alice",
                    ),
                    assignment("2024-03-01", "Bob", "bob", [
                        shadow("alice", "TRAINING"),
                    ]),
                    assignment("9999-12-31", "Bob", "bob", [
                        shadow("alice", "MENTORING"),
                    ]),
                ],
            },
        ],
    },
    { id: "empty", scheduleRuns: [] },
];

test("calendar uses all-day dates, escaped text, byte-safe folding and stable event IDs", () => {
    const feed = renderCalendar(months, "ALL", "alice");
    assert.match(feed, /DTSTART;VALUE=DATE:20240229/);
    assert.match(feed, /DTSTART;VALUE=DATE:99991231/);
    assert.match(feed, /SUMMARY:Standby: Alice\\, 名\\\\name\\;\\n/);
    assert.match(feed, /DTSTAMP:20261001T123000Z/);
    for (const line of feed.split("\r\n"))
        assert.ok(Buffer.byteLength(line) <= 75);
    const revised = structuredClone(months);
    revised[0].scheduleRuns[0].assignments[0].nameSnapshot = "New person";
    revised[0].scheduleRuns[0].publishedAt = new Date("2026-11-01T00:00:00Z");
    assert.equal(
        feed.match(/UID:[^\r]+/)[0],
        renderCalendar(revised, "ALL", "alice").match(/UID:[^\r]+/)[0],
    );
});

test("personal feed selects primary and both shadow duties for its owner", () => {
    const feed = renderCalendar(months, "PERSONAL", "alice");
    assert.match(feed, /SUMMARY:Primary standby/);
    assert.match(feed, /SUMMARY:Shadowing Bob/);
    assert.match(feed, /SUMMARY:Mentoring Bob/);
    assert.equal(
        (
            renderCalendar(months, "PERSONAL", "other").match(
                /BEGIN:VEVENT/g,
            ) ?? []
        ).length,
        0,
    );
    assert.equal(
        (renderCalendar(months, "ALL", "alice").match(/BEGIN:VEVENT/g) ?? [])
            .length,
        3,
    );
});

test("links require authentication, are hashed, owner scoped, replaceable and revocable", async () => {
    process.env.BETTER_AUTH_URL = "https://planner.example";
    state.rows.clear();
    state.months = months;
    const form = new FormData();
    form.set("type", "PERSONAL");
    form.set("action", "generate");
    state.session = null;
    assert.match((await manageCalendarSubscription({}, form)).error, /sign in/);
    state.session = { user: { id: "alice" } };
    const first = await manageCalendarSubscription({}, form);
    const token = new URL(first.url).pathname.split("/").pop();
    assert.equal(
        state.rows.get("alice:PERSONAL").tokenHash,
        createHash("sha256").update(token).digest("hex"),
    );
    const request = (value) =>
        GET(new Request("https://planner.example"), {
            params: Promise.resolve({ token: value }),
        });
    assert.equal((await request("invalid")).status, 404);
    const response = await request(token);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/calendar/);
    assert.match(await response.text(), /SUMMARY:Shadowing Bob/);
    assert.deepEqual(state.query.where, { status: "PUBLISHED" });
    assert.deepEqual(state.query.select.scheduleRuns.orderBy, [
        { publishedAt: "desc" },
        { version: "desc" },
    ]);
    assert.equal(state.query.select.scheduleRuns.take, 1);
    const second = await manageCalendarSubscription({}, form);
    const replacement = new URL(second.url).pathname.split("/").pop();
    assert.equal((await request(token)).status, 404);
    assert.equal((await request(replacement)).status, 200);
    state.session = { user: { id: "bob" } };
    form.set("action", "revoke");
    await manageCalendarSubscription({}, form);
    assert.equal((await request(replacement)).status, 200);
    state.session = { user: { id: "alice" } };
    await manageCalendarSubscription({}, form);
    assert.equal((await request(replacement)).status, 404);
});
