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

test("invalid months and anonymous requests are rejected before querying data", async () => {
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
    state.session = null;
    assert.equal((await GET(request("?month=2026-10"))).status, 401);
    assert.equal(queries, before);
});
