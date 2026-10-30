import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const modules = {
    "next/cache": `export function revalidatePath() {}`,
    "better-auth/crypto": `export async function hashPassword() { return 'test-hash'; }`,
    "@/lib/auth-guard": `export async function requireAdmin() { return { user: { id: 'admin', name: 'Admin', email: 'admin@example.com' } }; }`,
    "@/lib/prisma": `export const prisma = globalThis.__accountCapTest.prisma;`,
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
const state = (globalThis.__accountCapTest = {
    users: [],
    createdMonth: null,
    rosterAdded: null,
    monthMembers: [],
    removedIds: [],
});
const tx = {
    async $executeRaw() {},
    async $queryRaw() {
        return [];
    },
    user: {
        async findUnique({ where }) {
            return (
                state.users.find((user) => user.email === where.email) ?? null
            );
        },
        async findMany({ where }) {
            return state.users.filter(
                (user) =>
                    where.id.in.includes(user.id) &&
                    where.role.in.includes(user.role),
            );
        },
        async create({ data }) {
            state.users.push(data);
            return data;
        },
    },
    planningMonth: {
        async findUnique({ where }) {
            return where.year_month
                ? null
                : {
                      id: "month",
                      status: "DRAFT",
                      members: state.monthMembers,
                      scheduleRuns: [],
                  };
        },
        async create({ data }) {
            state.createdMonth = data;
        },
    },
    planningMember: {
        async deleteMany({ where }) {
            state.removedIds = where.id.in;
        },
        async createMany({ data }) {
            state.rosterAdded = data;
        },
    },
};
state.prisma = {
    async $transaction(callback) {
        return callback(tx);
    },
};
const { createEngineer } = await import("../src/app/actions/users.ts");
const { createPlanningMonth, savePlanningMonthRoster } =
    await import("../src/app/actions/planning-months.ts");
function resetUsers() {
    state.users = Array.from({ length: 11 }, (_, i) => ({
        id: `user-${i}`,
        name: `Engineer ${i}`,
        email: `user-${i}@example.com`,
        role: "ENGINEER",
    }));
    state.createdMonth = null;
    state.rosterAdded = null;
    state.monthMembers = [];
    state.removedIds = [];
}
function rosterForm(count) {
    const form = new FormData();
    form.set("month", "2027-01");
    form.set("planningMonthId", "month");
    form.set("rosterVersion", "2");
    for (let i = 0; i < count; i++) form.append("memberIds", `user-${i}`);
    return form;
}

test("an admin can create an engineer when the team already has more than ten", async () => {
    resetUsers();
    const form = new FormData();
    form.set("name", "New Engineer");
    form.set("email", "new@example.com");
    form.set("password", "test-password");
    const result = await createEngineer({}, form);
    assert.match(result.success, /can now sign in/);
    assert.equal(state.users.length, 12);
    assert.equal(state.users.at(-1).accounts.create.password, "test-hash");
    const duplicate = await createEngineer({}, form);
    assert.match(duplicate.error, /already exists/);
    assert.equal(state.users.length, 12);
});

test("month creation and roster editing work when the team has more than ten engineers", async () => {
    resetUsers();
    let result = await createPlanningMonth({}, rosterForm(3));
    assert.ok(result.success, result.error);
    assert.equal(state.createdMonth.members.create.length, 3);
    result = await savePlanningMonthRoster({}, rosterForm(3));
    assert.ok(result.success, result.error);
    assert.equal(state.rosterAdded.length, 3);
});

test("the existing monthly roster limit still applies", async () => {
    resetUsers();
    const form = rosterForm(12);
    const create = await createPlanningMonth({}, form);
    const update = await savePlanningMonthRoster({}, form);
    assert.match(create.error, /at most 11 participants/);
    assert.match(update.error, /at most 11 participants/);
    assert.equal(state.createdMonth, null);
    assert.equal(state.rosterAdded, null);
});

test("admins and engineers can participate together or in an all-admin month", async () => {
    resetUsers();
    state.users[0].role = "ADMIN";
    state.users[1].role = "ADMIN";
    let result = await createPlanningMonth({}, rosterForm(3));
    assert.ok(result.success, result.error);
    assert.deepEqual(
        state.createdMonth.members.create.map((member) => member.roleSnapshot),
        ["ADMIN", "ADMIN", "ENGINEER"],
    );
    state.createdMonth = null;
    result = await createPlanningMonth({}, rosterForm(2));
    assert.ok(result.success, result.error);
    assert.deepEqual(
        state.createdMonth.members.create.map((member) => member.roleSnapshot),
        ["ADMIN", "ADMIN"],
    );
    result = await savePlanningMonthRoster({}, rosterForm(2));
    assert.ok(result.success, result.error);
    assert.equal(state.rosterAdded.length, 2);
});

test("a promoted participant stays in the roster without losing their submission", async () => {
    resetUsers();
    state.users[0].role = "ADMIN";
    state.monthMembers = [{ id: "existing-member", userId: "user-0" }];
    const result = await savePlanningMonthRoster({}, rosterForm(1));
    assert.ok(result.success, result.error);
    assert.deepEqual(state.removedIds, []);
    assert.equal(state.rosterAdded, null);
});

test("eleven participants are accepted, independent of role", async () => {
    resetUsers();
    for (const user of state.users) user.role = "ADMIN";
    const result = await createPlanningMonth({}, rosterForm(11));
    assert.ok(result.success, result.error);
    assert.equal(state.createdMonth.members.create.length, 11);
});

test("an old roster form cannot overwrite the roster", async () => {
    resetUsers();
    const form = rosterForm(1);
    form.delete("rosterVersion");
    const result = await savePlanningMonthRoster({}, form);
    assert.match(result.error, /out of date/);
    assert.equal(state.rosterAdded, null);
    assert.deepEqual(state.removedIds, []);
});

test("inactive members remain eligible for explicit historical roster selection", async () => {
    resetUsers();
    state.users[0].isActive = false;
    let result = await createPlanningMonth({}, rosterForm(1));
    assert.ok(result.success, result.error);
    assert.equal(state.createdMonth.members.create[0].userId, "user-0");
    state.monthMembers = [{ id: "historical-member", userId: "user-0" }];
    result = await savePlanningMonthRoster({}, rosterForm(1));
    assert.ok(result.success, result.error);
    assert.deepEqual(state.removedIds, []);
    assert.equal(state.rosterAdded, null);
});
