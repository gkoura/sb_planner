import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { parseAthensDateTime } from "../src/lib/call-outs.ts";

const reactUrl = import.meta.resolve("react");
const modules = {
    "@/lib/auth-guard": `
        export async function getCurrentSession() { return globalThis.__teamCallOutTest.session; }
        export async function requireAdmin() {
            const session = await getCurrentSession();
            if (!session) throw new Error('redirect:/sign-in');
            if (session.user.role !== 'ADMIN') throw new Error('redirect:/');
            return session;
        }`,
    "@/lib/prisma": `export const prisma = globalThis.__teamCallOutTest.prisma;`,
    "next/link": `import React from '${reactUrl}'; export default function Link(props) { return React.createElement('a', props); }`,
    "@/components/ui/button": `import React from '${reactUrl}'; export function Button({ children, type, render }) { return render ? React.cloneElement(render, {}, children) : React.createElement('button', { type }, children); }`,
    "@/components/ui/export-menu": `import React from '${reactUrl}'; export function ExportMenu({ items }) { return items.map(item => React.createElement('a', { key: item.href, href: item.href }, item.label)); }`,
};
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier in modules)
            return {
                url: `data:text/javascript,${encodeURIComponent(modules[specifier])}`,
                shortCircuit: true,
            };
        if (specifier.startsWith("@/")) {
            const base = new URL(
                `../src/${specifier.slice(2)}`,
                import.meta.url,
            );
            return nextResolve(
                `${base.href}${existsSync(new URL(`${base.href}.ts`)) ? ".ts" : ".tsx"}`,
                context,
            );
        }
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (url.endsWith(".tsx"))
            return {
                format: "module",
                shortCircuit: true,
                source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
                    compilerOptions: {
                        jsx: ts.JsxEmit.ReactJSX,
                        module: ts.ModuleKind.ESNext,
                    },
                }).outputText,
            };
        return nextLoad(url, context);
    },
});

const users = [
    { id: "admin", name: "Admin", email: "admin@example.test", isActive: true },
    {
        id: "engineer",
        name: "Alex",
        email: "alex@example.test",
        isActive: true,
    },
    {
        id: "inactive",
        name: "Alex",
        email: "former@example.test",
        isActive: false,
    },
];
function entry(id, userId, start, end, reason, role = "SUPPORT") {
    return {
        id,
        userId,
        user: users.find((user) => user.id === userId),
        startedAt: parseAthensDateTime(start),
        endedAt: parseAthensDateTime(end),
        role,
        dutyDate: role === "SUPPORT" ? null : start.slice(0, 10),
        reason,
    };
}
const entries = [
    entry(
        "overnight",
        "engineer",
        "2026-10-31T23:30",
        "2026-11-01T00:30",
        "Cross-month incident",
        "PRIMARY",
    ),
    entry(
        "november",
        "engineer",
        "2026-11-01T00:30",
        "2026-11-01T01:31",
        "November support",
    ),
    entry(
        "inactive",
        "inactive",
        "2026-10-20T10:00",
        "2026-10-20T10:15",
        "Historical support",
    ),
    entry(
        "admin",
        "admin",
        "2026-10-21T10:00",
        "2026-10-21T10:15",
        "Admin support",
    ),
];
const state = (globalThis.__teamCallOutTest = {
    session: null,
    callOutQueries: [],
    userQueries: 0,
    prisma: {
        user: {
            async findMany() {
                state.userQueries++;
                return users;
            },
        },
        callOut: {
            async findMany(query) {
                state.callOutQueries.push(query);
                return entries
                    .filter(
                        (entry) =>
                            !query.where.userId ||
                            entry.userId === query.where.userId,
                    )
                    .toSorted((a, b) =>
                        query.orderBy[0].startedAt === "asc"
                            ? a.startedAt - b.startedAt
                            : b.startedAt - a.startedAt,
                    );
            },
        },
    },
});
const { GET } = await import("../src/app/api/admin/call-outs/export/route.ts");
const { default: Page } =
    await import("../src/app/(app)/admin/call-outs/page.tsx");
const { parseTeamCallOutFilters, teamCallOutExportUrl } =
    await import("../src/lib/team-call-outs.ts");
const request = (query) =>
    new Request(
        `https://example.test/api/admin/call-outs/export${query ?? ""}`,
    );
function reset(role = "ADMIN") {
    state.session = role ? { user: { id: "admin", role } } : null;
    state.callOutQueries = [];
    state.userQueries = 0;
}
async function pageContent(params = {}) {
    const suspense = Page({ searchParams: Promise.resolve(params) });
    return suspense.props.children.type(suspense.props.children.props);
}
async function renderPage(params) {
    return renderToStaticMarkup(await pageContent(params));
}

test("team page and export deny anonymous and engineer access before reading any team data", async () => {
    for (const role of [null, "ENGINEER"]) {
        reset(role);
        assert.equal(
            (await GET(request("?userId=inactive"))).status,
            role ? 403 : 401,
        );
        await assert.rejects(pageContent(), /redirect:/);
        assert.equal(state.callOutQueries.length, 0);
        assert.equal(state.userQueries, 0);
    }
});

test("admins export all members, including inactive members, with member identity per daily row", async () => {
    reset();
    const response = await GET(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    const csv = await response.text();
    assert.match(csv, /^"member_name","member_email","work_date"/);
    assert.match(csv, /Admin support/);
    assert.match(csv, /"Alex","former@example.test"/);
    assert.match(csv, /Historical support/);
    assert.equal(csv.split("\r\n").length, 5);
});

test("member and month filters retain cross-month daily portions and exclude other members", async () => {
    reset();
    const response = await GET(request("?userId=engineer&month=2026-10"));
    const csv = await response.text();
    assert.match(
        response.headers.get("Content-Disposition"),
        /team-call-outs-member-2026-10.csv/,
    );
    assert.equal(csv.split("\r\n").length, 2);
    assert.match(csv, /"2026-10-31","1","60"/);
    assert.doesNotMatch(csv, /\r?\n[^\r\n]*"2026-11-01","1","30"/);
    assert.doesNotMatch(
        csv,
        /Historical support|Admin support|November support/,
    );
    assert.equal(state.callOutQueries[0].where.userId, "engineer");
    const november = await (
        await GET(request("?userId=engineer&month=2026-11"))
    ).text();
    assert.match(november, /"2026-11-01","2","61","","SUPPORT"/);
    assert.doesNotMatch(november, /Cross-month incident/);
    const inactive = await (await GET(request("?userId=inactive"))).text();
    assert.match(inactive, /Historical support/);
    assert.doesNotMatch(
        inactive,
        /Admin support|Cross-month incident|November support/,
    );
});

test("invalid and repeated export filters fail before reading logs; empty results retain CSV headers", async () => {
    reset();
    for (const query of [
        "?month=2026-13",
        "?month=0000-01",
        "?month=2026-1",
        "?month=garbage",
        "?month=2026-10&month=2026-11",
        "?userId=admin&userId=inactive",
    ])
        assert.equal((await GET(request(query))).status, 400);
    assert.equal(state.callOutQueries.length, 0);
    const empty = await (await GET(request("?month=2025-01"))).text();
    assert.equal(empty.split("\r\n").length, 1);
    const cleared = await GET(request("?userId=&month="));
    assert.equal(cleared.status, 200);
});

test("admin page renders distinct member identities, hours, history, and matching filtered exports", async () => {
    reset();
    const html = await renderPage({ month: "2026-10" });
    assert.match(html, /Team call-outs/);
    assert.match(html, /Alex \(inactive\)/);
    assert.match(html, /alex@example.test/);
    assert.match(html, /former@example.test/);
    assert.match(html, /Rounded hours<\/dt><dd[^>]*>3<\/dd>/);
    assert.match(html, /3 call-outs/);
    assert.match(html, /3 hours logged/);
    assert.match(html, /\/api\/admin\/call-outs\/export\?month=2026-10/);
    assert.doesNotMatch(
        html,
        /November support|\/api\/call-outs\/export|>Edit<|>Delete</,
    );

    const member = await renderPage({ userId: "engineer", month: "2026-10" });
    assert.match(member, /Rounded hours<\/dt><dd[^>]*>1<\/dd>/);
    assert.match(member, /userId=engineer&amp;month=2026-10/);
    assert.match(member, /1 hour rounded.*60 minutes worked/);
    assert.doesNotMatch(
        member,
        /Historical support|Admin support|November support/,
    );
});

test("page shows empty and invalid filter states without broadening the log query", async () => {
    reset();
    assert.match(await renderPage({ month: "2025-01" }), /No call-outs found/);
    for (const params of [
        { month: "invalid" },
        { userId: "unknown" },
        { userId: ["admin", "inactive"] },
    ]) {
        state.callOutQueries = [];
        const html = await renderPage(params);
        assert.match(html, /role="alert"/);
        assert.doesNotMatch(html, /Export results as CSV|Historical support/);
        assert.equal(state.callOutQueries.length, 0);
    }
});

test("CSV protects member identities and reasons from formulas and escapes quotes and multiline text", async () => {
    reset();
    const { callOutCsv } = await import("../src/lib/call-out-export.ts");
    const csv = callOutCsv(
        [
            {
                ...entries[0],
                reason: '=HYPERLINK("bad")\nsecond line',
                user: { name: "+Formula", email: "@address" },
            },
        ],
        true,
    );
    assert.match(csv, /"'\+Formula","'@address"/);
    assert.match(csv, /"'=HYPERLINK\(""bad""\)\nsecond line"/);
});

test("export links safely encode member IDs and filters accept cleared fields", () => {
    assert.equal(
        teamCallOutExportUrl({ userId: "id&month=other", month: "2026-10" }),
        "/api/admin/call-outs/export?userId=id%26month%3Dother&month=2026-10",
    );
    assert.deepEqual(
        parseTeamCallOutFilters({ userId: "", month: "" }).filters,
        { userId: undefined, month: undefined },
    );
});
