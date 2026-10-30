import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const modules = {
    "next/navigation": `export function redirect(to) { throw new Error('redirect:' + to); }`,
    "next/cache": `export function revalidatePath() {}`,
    "@/lib/auth-guard": `export async function getCurrentSession() { return globalThis.__announcementTest.session; }`,
    "@/lib/prisma": `export const prisma = globalThis.__announcementTest.prisma;`,
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
const rows = new Set();
const state = (globalThis.__announcementTest = {
    session: { user: { id: "first" } },
    prisma: {
        announcementDismissal: {
            async createMany({ data, skipDuplicates }) {
                assert.equal(skipDuplicates, true);
                rows.add(`${data.userId}:${data.announcementId}`);
            },
        },
    },
});
const { dismissAnnouncement } =
    await import("../src/app/actions/announcements.ts");
function form(id = "call-out-logging-2026-10", open = false) {
    const data = new FormData();
    data.set("announcementId", id);
    if (open) data.set("open", "1");
    return data;
}

test("dismissals are idempotent and belong to the signed-in user", async () => {
    await dismissAnnouncement(form());
    await dismissAnnouncement(form());
    assert.deepEqual([...rows], ["first:call-out-logging-2026-10"]);
    state.session = { user: { id: "second" } };
    await assert.rejects(
        dismissAnnouncement(form(undefined, true)),
        /redirect:\/call-outs/,
    );
    assert.equal(rows.size, 2);
});

test("anonymous users and unknown announcements cannot write dismissals", async () => {
    state.session = null;
    await assert.rejects(dismissAnnouncement(form()), /redirect:\/sign-in/);
    state.session = { user: { id: "first" } };
    await assert.rejects(
        dismissAnnouncement(form("unknown")),
        /Unknown announcement/,
    );
    assert.equal(rows.size, 2);
});
