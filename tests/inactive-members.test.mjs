import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const state = (globalThis.__inactiveMembersTest = {});
const modules = {
    "next/cache": `export function revalidatePath() {}`,
    "better-auth/crypto": `export async function hashPassword() { return 'hash'; }`,
    "better-auth": `export function betterAuth(options) { globalThis.__inactiveMembersTest.authOptions = options; return {}; }`,
    "better-auth/adapters/prisma": `export function prismaAdapter() { return {}; }`,
    "@/lib/auth-guard": `export async function requireAdmin() { if (globalThis.__inactiveMembersTest.denied) throw new Error('unauthorized'); return { user: { id: 'admin' } }; }`,
    "@/lib/prisma": `export const prisma = globalThis.__inactiveMembersTest.prisma;`,
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
    load(url, context, nextLoad) {
        if (url.endsWith("/member-picker.tsx"))
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
function reset() {
    state.denied = false;
    state.users = new Map([
        [
            "admin",
            { id: "admin", name: "Admin", role: "ADMIN", isActive: true },
        ],
        [
            "former",
            { id: "former", name: "Former", role: "ADMIN", isActive: true },
        ],
    ]);
    state.sessions = ["former", "admin"];
    state.feeds = ["former", "admin"];
    state.updates = [];
}
const tx = {
    user: {
        async findUnique({ where }) {
            return state.users.get(where.id) ?? null;
        },
        async update({ where, data }) {
            state.updates.push(data);
            Object.assign(state.users.get(where.id), data);
        },
        async count() {
            return [...state.users.values()].filter(
                (user) => user.role === "ADMIN" && user.isActive,
            ).length;
        },
    },
    session: {
        async deleteMany({ where }) {
            state.sessions = state.sessions.filter((id) => id !== where.userId);
        },
    },
    calendarSubscription: {
        async deleteMany({ where }) {
            state.feeds = state.feeds.filter((id) => id !== where.userId);
        },
    },
};
state.prisma = {
    ...tx,
    async $transaction(fn, options) {
        assert.equal(options.isolationLevel, "Serializable");
        return fn(tx);
    },
};
const { changeUserActiveState, changeUserRole } =
    await import("../src/app/actions/users.ts");
await import("../src/lib/auth.ts");
const { MemberPicker } =
    await import("../src/components/planning-months/member-picker.tsx");
function form(userId, active) {
    const value = new FormData();
    value.set("userId", userId);
    value.set("isActive", String(active));
    return value;
}

test("deactivation retains the user, removes admin access, sessions and feeds; reactivation keeps engineer access", async () => {
    reset();
    const result = await changeUserActiveState({}, form("former", false));
    assert.match(result.success, /inactive/);
    assert.equal(state.users.get("former").isActive, false);
    assert.equal(state.users.get("former").role, "ENGINEER");
    assert.deepEqual(state.sessions, ["admin"]);
    assert.deepEqual(state.feeds, ["admin"]);
    assert.ok((await changeUserActiveState({}, form("former", true))).success);
    assert.equal(state.users.get("former").isActive, true);
    assert.equal(state.users.get("former").role, "ENGINEER");
    assert.deepEqual(state.sessions, ["admin"]);
});

test("self-deactivation, stale admin access, missing accounts and malformed requests cannot write", async () => {
    reset();
    assert.match(
        (await changeUserActiveState({}, form("admin", false))).error,
        /another admin/,
    );
    assert.ok((await changeUserActiveState({}, form("missing", false))).error);
    assert.ok(
        (await changeUserActiveState({}, form("former", "invalid"))).error,
    );
    state.users.get("admin").isActive = false;
    assert.match(
        (await changeUserActiveState({}, form("former", false))).error,
        /access has changed/,
    );
    assert.deepEqual(state.updates, []);
    state.denied = true;
    await assert.rejects(
        changeUserActiveState({}, form("former", false)),
        /unauthorized/,
    );
});

test("inactive users cannot receive admin access or create sign-in sessions", async () => {
    reset();
    state.users.get("former").isActive = false;
    const value = form("former", false);
    value.set("role", "ADMIN");
    assert.match((await changeUserRole({}, value)).error, /Reactivate/);
    const before = state.authOptions.databaseHooks.session.create.before;
    assert.equal(await before({ userId: "former" }), false);
    assert.equal(await before({ userId: "missing" }), false);
    assert.equal(await before({ userId: "admin" }), undefined);
});

test("participant picker hides inactive options but preserves selected historical members", () => {
    const members = [
        {
            id: "active",
            name: "Active",
            email: "active@example.com",
            isActive: true,
        },
        {
            id: "former",
            name: "Former",
            email: "former@example.com",
            isActive: false,
        },
    ];
    const html = renderToStaticMarkup(
        React.createElement(MemberPicker, { members, disabled: false }),
    );
    assert.match(html, /Include inactive members/);
    assert.match(html, /<label hidden=""[^>]*>.*?value="former"/);
    const existing = renderToStaticMarkup(
        React.createElement(MemberPicker, {
            members,
            selectedMemberIds: ["former"],
            disabled: false,
        }),
    );
    assert.doesNotMatch(existing, /<label hidden=/);
    assert.match(existing, /checked="" value="former"/);
});
