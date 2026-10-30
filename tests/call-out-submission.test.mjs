import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const modules = {
    "next/navigation": `export function redirect(to) { throw new Error('redirect:' + to); }`,
    "next/cache": `export function revalidatePath() {}`,
    "@/lib/auth-guard": `export async function getCurrentSession() { return globalThis.__callOutTest.session; }`,
    "@/lib/prisma": `export const prisma = globalThis.__callOutTest.prisma;`,
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
const rows = new Map();
const state = (globalThis.__callOutTest = {
    session: { user: { id: "user" } },
    prisma: {
        callOut: {
            async createMany({ data, skipDuplicates }) {
                assert.equal(skipDuplicates, true);
                if (!rows.has(data.id)) rows.set(data.id, data);
            },
            async findFirst({ where }) {
                const row = rows.get(where.id);
                return row?.userId === where.userId ? row : null;
            },
        },
    },
});
const { createCallOut } = await import("../src/app/actions/call-outs.ts");
function form(id) {
    const data = new FormData();
    for (const [key, value] of Object.entries({
        submissionId: id,
        reason: "Incident",
        role: "PRIMARY",
        start: "2026-10-21T23:00",
        end: "2026-10-22T01:30",
    }))
        data.set(key, value);
    return data;
}

test("repeated submissions create one record; a new form can create another", async () => {
    rows.clear();
    state.session = { user: { id: "user" } };
    const id = "11111111-1111-4111-8111-111111111111";
    const results = await Promise.allSettled([
        createCallOut(form(id)),
        createCallOut(form(id)),
    ]);
    assert.ok(
        results.every(
            (result) =>
                result.status === "rejected" &&
                result.reason.message === "redirect:/call-outs?saved=1",
        ),
    );
    assert.equal(rows.size, 1);
    await assert.rejects(
        createCallOut(form("22222222-2222-4222-8222-222222222222")),
        /redirect:\/call-outs\?saved=1/,
    );
    assert.equal(rows.size, 2);
});

test("a submission identifier belonging to another user cannot be reused", async () => {
    state.session = { user: { id: "other" } };
    await assert.rejects(
        createCallOut(form("11111111-1111-4111-8111-111111111111")),
        /Unable to save/,
    );
    assert.equal(rows.size, 2);
});
