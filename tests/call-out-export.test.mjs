import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { parseAthensDateTime } from "../src/lib/call-outs.ts";

const modules = {
    "@/lib/auth-guard": `export async function getCurrentSession() { return globalThis.__exportTest.session; }`,
    "@/lib/prisma": `export const prisma = globalThis.__exportTest.prisma;`,
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
const entries = [
    {
        userId: "user",
        reason: "Overnight",
        startedAt: parseAthensDateTime("2026-10-31T23:30"),
        endedAt: parseAthensDateTime("2026-11-01T00:30"),
        role: "PRIMARY",
        dutyDate: "2026-10-31",
    },
    {
        userId: "user",
        reason: "November support",
        startedAt: parseAthensDateTime("2026-11-01T00:30"),
        endedAt: parseAthensDateTime("2026-11-01T01:30"),
        role: "SUPPORT",
        dutyDate: null,
    },
    {
        userId: "other",
        reason: "Other user",
        startedAt: parseAthensDateTime("2026-10-20T10:00"),
        endedAt: parseAthensDateTime("2026-10-20T11:00"),
        role: "SUPPORT",
        dutyDate: null,
    },
];
let queries = 0;
const state = (globalThis.__exportTest = {
    session: { user: { id: "user" } },
    prisma: {
        callOut: {
            async findMany({ where }) {
                queries++;
                assert.deepEqual(where, { userId: "user" });
                return entries.filter((entry) => entry.userId === where.userId);
            },
        },
    },
});
const { GET } = await import("../src/app/api/call-outs/export/route.ts");
const request = (query = "") =>
    new Request(`https://example.test/api/call-outs/export${query}`);

test("monthly CSV follows Athens start-month grouping and retains overnight portions", async () => {
    const response = await GET(request("?month=2026-10"));
    assert.equal(response.status, 200);
    assert.match(
        response.headers.get("Content-Disposition"),
        /call-outs-2026-10.csv/,
    );
    const csv = await response.text();
    assert.equal(csv.split("\r\n").length, 3);
    assert.match(csv, /"2026-10-31","1","30"/);
    assert.match(csv, /"2026-11-01","1","30"/);
    assert.doesNotMatch(csv, /November support|Other user/);
    const november = await (await GET(request("?month=2026-11"))).text();
    assert.match(november, /November support/);
    assert.doesNotMatch(november, /Overnight/);
    assert.match(november, /"","SUPPORT"/);
});

test("unfiltered export still includes all of the user's data; empty months have a header", async () => {
    const response = await GET(request());
    assert.match(
        response.headers.get("Content-Disposition"),
        /filename="call-outs.csv"/,
    );
    const csv = await response.text();
    assert.match(csv, /Overnight/);
    assert.match(csv, /November support/);
    assert.doesNotMatch(csv, /Other user/);
    const empty = await (await GET(request("?month=2026-09"))).text();
    assert.equal(empty.split("\r\n").length, 1);
});

test("formatted exports retain one row per log, Athens dates, and unsplit overnight times", async () => {
    const response = await GET(request("?month=2026-10&format=formatted"));
    assert.equal(response.status, 200);
    assert.equal(
        response.headers.get("Content-Type"),
        "text/plain; charset=utf-8",
    );
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.match(
        response.headers.get("Content-Disposition"),
        /call-outs-2026-10-formatted\.txt/,
    );
    assert.equal(await response.text(), "31/10/26 | 23:30 - 00:30 | Overnight");
    const all = await GET(request("?format=formatted"));
    assert.match(
        all.headers.get("Content-Disposition"),
        /call-outs-formatted\.txt/,
    );
    assert.equal(
        await all.text(),
        "31/10/26 | 23:30 - 00:30 | Overnight\r\n01/11/26 | 00:30 - 01:30 | November support",
    );
    assert.equal(
        await (await GET(request("?month=2026-09&format=formatted"))).text(),
        "",
    );
});

test("formatted exports preserve separate logs with the same reason and flatten multiline reasons", async () => {
    const { callOutFormatted } = await import("../src/lib/call-out-export.ts");
    const entry = { ...entries[0], reason: "Investigate\r\nRestore | verify" };
    assert.equal(
        callOutFormatted([entry, entry]),
        "31/10/26 | 23:30 - 00:30 | Investigate Restore | verify\r\n31/10/26 | 23:30 - 00:30 | Investigate Restore | verify",
    );
});

test("invalid months and formats and anonymous requests are rejected before querying data", async () => {
    const before = queries;
    for (const month of [
        "",
        "2026-13",
        "2026-00",
        "0000-01",
        "2026-1",
        "garbage",
    ])
        assert.equal((await GET(request(`?month=${month}`))).status, 400);
    assert.equal((await GET(request("?format=unknown"))).status, 400);
    state.session = null;
    assert.equal((await GET(request("?month=2026-10"))).status, 401);
    assert.equal((await GET(request("?format=formatted"))).status, 401);
    assert.equal(queries, before);
});

test("overtime CSV exports keep the distinct role and omit standby dates", async () => {
    const { callOutCsv, callOutFormatted } =
        await import("../src/lib/call-out-export.ts");
    const entry = {
        role: "OVERTIME",
        dutyDate: "2026-11-15",
        reason: "Extra project work",
        startedAt: new Date("2026-11-16T16:00:00Z"),
        endedAt: new Date("2026-11-16T17:30:00Z"),
        user: { name: "Engineer", email: "engineer@example.com" },
    };
    for (const includeMember of [false, true]) {
        const csv = callOutCsv([entry], includeMember);
        assert.match(csv, /"2026-11-16","2","90","","OVERTIME"/);
        assert.doesNotMatch(csv, /2026-11-15/);
    }
    assert.equal(
        callOutFormatted([entry]),
        "16/11/26 | 18:00 - 19:30 | Extra project work",
    );
});
