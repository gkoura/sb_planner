import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const modules = {
    "next/headers": `export async function headers() { return new Headers(); }`,
    "next/navigation": `export function redirect(to) { throw new Error('redirect:' + to); }`,
    "next/cache": `export function revalidatePath() {}`,
    react: `export function cache(fn) { return fn; }`,
    "@/lib/auth": `export const auth = { api: { getSession: async () => globalThis.__authTest.session } };`,
    "@/lib/prisma": `export const prisma = globalThis.__authTest.prisma;`,
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

const state = (globalThis.__authTest = {
    session: null,
    query: null,
    transactionCalled: false,
    prisma: {
        user: {
            async findUnique() {
                return (
                    state.account ?? {
                        isActive: true,
                        role: state.session?.user.role,
                    }
                );
            },
        },
        planningMember: {
            async findUnique(query) {
                state.query = query;
                return null;
            },
        },
        async $transaction() {
            state.transactionCalled = true;
            throw new Error("Unexpected write");
        },
    },
});
const { requireAdmin } = await import("../src/lib/auth-guard.ts");
const { submitAvailability, submitAvailabilityForMember } =
    await import("../src/app/actions/availability.ts");

test("admin guard redirects anonymous and engineer sessions and allows admins", async () => {
    state.session = null;
    await assert.rejects(requireAdmin(), /redirect:\/sign-in/);
    state.session = { user: { id: "engineer", role: "ENGINEER" } };
    await assert.rejects(requireAdmin(), /redirect:\/$/);
    state.session = { user: { id: "admin", role: "ADMIN" } };
    assert.equal((await requireAdmin()).user.id, "admin");
});

test("self availability identifies the member by the session, not form data", async () => {
    state.session = { user: { id: "engineer", role: "ENGINEER" } };
    state.query = null;
    state.transactionCalled = false;
    const form = new FormData();
    form.set("planningMonthId", "month");
    form.set("mode", "UNAVAILABLE");
    form.set("planningMemberId", "another-member");
    const result = await submitAvailability({}, form);
    assert.match(result.error, /not a participant/);
    assert.deepEqual(state.query.where.planningMonthId_userId, {
        planningMonthId: "month",
        userId: "engineer",
    });
    assert.equal(state.transactionCalled, false);
});

test("admin-assisted availability rejects an engineer before any write", async () => {
    state.session = { user: { id: "engineer", role: "ENGINEER" } };
    state.transactionCalled = false;
    await assert.rejects(
        submitAvailabilityForMember({}, new FormData()),
        /redirect:\/$/,
    );
    assert.equal(state.transactionCalled, false);
});

test("inactive accounts are denied even when a session still exists", async () => {
    state.session = { user: { id: "departed", role: "ADMIN" } };
    state.account = { isActive: false, role: "ADMIN" };
    await assert.rejects(requireAdmin(), /redirect:\/sign-in/);
    state.account = null;
});
