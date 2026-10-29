import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    generateSchedule,
    generateShadowsForAssignments,
} from "../src/lib/scheduler.ts";

async function fixture(name) {
    return JSON.parse(
        await readFile(
            new URL(`./fixtures/scheduler/${name}.json`, import.meta.url),
            "utf8",
        ),
    );
}

function assertValidSchedule(result, year, month, members) {
    assert.equal(result.ok, true, result.ok ? undefined : result.message);
    const expectedDays = new Date(year, month, 0).getDate();
    assert.equal(result.assignments.length, expectedDays);

    const memberById = new Map(members.map((member) => [member.id, member]));
    const priorMemberByDate = new Map();
    for (let index = 0; index < result.assignments.length; index += 1) {
        const assignment = result.assignments[index];
        const day = index + 1;
        assert.equal(assignment.day, day);
        assert.equal(
            assignment.date,
            `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        );

        const member = memberById.get(assignment.memberId);
        assert.ok(member, `day ${day} must be assigned to a known participant`);
        const selectedDates = new Set(member.dates);
        const isAvailable =
            member.mode === "AVAILABLE"
                ? selectedDates.has(assignment.date)
                : !selectedDates.has(assignment.date);
        assert.ok(
            isAvailable,
            `${member.name} must be available on ${assignment.date}`,
        );
        assert.notEqual(
            priorMemberByDate.get(index),
            assignment.memberId,
            "adjacent days cannot use the same participant",
        );
        priorMemberByDate.set(index + 1, assignment.memberId);
    }

    const workloadTotal = result.workloads.reduce(
        (total, workload) => total + workload.assignedDays,
        0,
    );
    assert.equal(workloadTotal, expectedDays);
    for (const workload of result.workloads) {
        assert.equal(
            workload.assignedDays,
            result.assignments.filter(
                (assignment) => assignment.memberId === workload.memberId,
            ).length,
        );
    }
}

test("available and unavailable modes normalize to the same leap-year schedule", async () => {
    const data = await fixture("mode-parity");
    const availableMode = generateSchedule(
        data.year,
        data.month,
        data.availableMode,
    );
    const unavailableMode = generateSchedule(
        data.year,
        data.month,
        data.unavailableMode,
    );

    assertValidSchedule(
        availableMode,
        data.year,
        data.month,
        data.availableMode,
    );
    assertValidSchedule(
        unavailableMode,
        data.year,
        data.month,
        data.unavailableMode,
    );
    assert.deepEqual(availableMode.assignments, unavailableMode.assignments);
    assert.equal(availableMode.assignments.length, 29);
    assert.equal(availableMode.fairnessScore, data.expectedFairnessScore);
    assert.equal(unavailableMode.fairnessScore, data.expectedFairnessScore);
});

test("every available date is mandatory when a participant has five or fewer", async () => {
    const data = await fixture("mandatory-five");
    const result = generateSchedule(data.year, data.month, data.members);

    assertValidSchedule(result, data.year, data.month, data.members);
    assert.deepEqual(
        result.assignments
            .filter(
                (assignment) => assignment.memberId === data.mandatoryMemberId,
            )
            .map((assignment) => assignment.date),
        data.mandatoryDates,
    );
});

test("conflicting mandatory assignments return an actionable infeasibility", async () => {
    const data = await fixture("mandatory-conflict");
    const result = generateSchedule(data.year, data.month, data.members);

    assert.equal(result.ok, false);
    assert.equal(result.code, "INFEASIBLE");
    assert.equal(result.message, data.expectedMessage);
    assert.equal(result.visitedStates, 0);
});

test("an uncovered date is reported with its exact ISO date", async () => {
    const data = await fixture("uncovered-day");
    const result = generateSchedule(data.year, data.month, data.members);

    assert.equal(result.ok, false);
    assert.equal(result.code, "INFEASIBLE");
    assert.equal(result.message, data.expectedMessage);
});

test("fairness minimizes the Python absolute-deviation objective", async () => {
    const data = await fixture("fairness-31-days");
    const result = generateSchedule(data.year, data.month, data.members);

    assertValidSchedule(result, data.year, data.month, data.members);
    assert.equal(result.fairnessScore, data.expectedFairnessScore);
    assert.deepEqual(
        result.workloads
            .map((workload) => workload.assignedDays)
            .sort((a, b) => a - b),
        data.expectedWorkloads,
    );
});

test("the result is deterministic when input members are reordered", async () => {
    const data = await fixture("fairness-31-days");
    const first = generateSchedule(data.year, data.month, data.members);
    const second = generateSchedule(
        data.year,
        data.month,
        [...data.members].reverse(),
    );

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.deepEqual(first.assignments, second.assignments);
});

test("an alternating-day constraint that cannot be met is infeasible", () => {
    const result = generateSchedule(2024, 2, [
        { id: "solo", name: "Solo", mode: "UNAVAILABLE", dates: [] },
    ]);

    assert.equal(result.ok, false);
    assert.equal(result.code, "INFEASIBLE");
});

test("invalid inputs return structured validation failures", () => {
    const validMember = {
        id: "a",
        name: "Alice",
        mode: "UNAVAILABLE",
        dates: [],
    };
    const cases = [
        [2024, 0, [validMember]],
        [0, 1, [validMember]],
        [2024, 1, []],
        [2024, 1, [validMember, { ...validMember, id: "b", name: "Alice" }]],
        [2024, 1, [validMember, { ...validMember, id: "a", name: "Bob" }]],
        [2024, 2, [{ ...validMember, mode: "INVALID" }]],
        [
            2024,
            2,
            [{ ...validMember, mode: "AVAILABLE", dates: ["2024-02-30"] }],
        ],
        [
            2024,
            2,
            [
                {
                    ...validMember,
                    mode: "AVAILABLE",
                    dates: ["2024-02-01", "2024-02-01"],
                },
            ],
        ],
        [
            2024,
            2,
            [{ ...validMember, mode: "AVAILABLE", dates: ["2024-01-31"] }],
        ],
        [
            2024,
            2,
            Array.from({ length: 12 }, (_, index) => ({
                ...validMember,
                id: `id-${index}`,
                name: `Engineer ${index}`,
            })),
        ],
    ];

    for (const [year, month, members] of cases) {
        const result = generateSchedule(year, month, members);
        assert.equal(result.ok, false);
        assert.equal(result.code, "INVALID_INPUT");
        assert.ok(result.message.length > 0);
    }
});

function shadowCounterexample() {
    return [
        ...["A", "B", "C", "D"].map((id) => ({
            id,
            name: id,
            mode: "UNAVAILABLE",
            dates: [],
            participationMode: id === "A" ? "MENTORED" : "NORMAL",
        })),
        {
            id: "T",
            name: "T",
            mode: "AVAILABLE",
            dates: ["2026-02-01"],
            participationMode: "TRAINEE",
            shadowDayCount: 1,
        },
    ];
}

test("generation finds an equally balanced primary rotation with feasible shadows", () => {
    const members = shadowCounterexample();
    const result = generateSchedule(2026, 2, members);
    assertValidSchedule(result, 2026, 2, members);
    assert.equal(result.fairnessScore, 0);
    assert.deepEqual(result, generateSchedule(2026, 2, [...members].reverse()));
    assert.equal(
        result.shadows.filter((shadow) => shadow.kind === "TRAINING").length,
        1,
    );
    assert.equal(
        result.shadows.find((shadow) => shadow.kind === "TRAINING").date,
        "2026-02-01",
    );
    assert.equal(
        result.shadows.filter((shadow) => shadow.kind === "MENTORING").length,
        7,
    );
    const work = new Map(members.map(({ id }) => [id, []]));
    for (const assignment of result.assignments)
        work.get(assignment.memberId).push(assignment.day);
    const shadowDates = new Set();
    for (const shadow of result.shadows) {
        const day = Number(shadow.date.slice(-2));
        const primary = result.assignments[day - 1];
        assert.ok(!shadowDates.has(shadow.date));
        shadowDates.add(shadow.date);
        assert.notEqual(primary.memberId, shadow.shadowMemberId);
        assert.equal(shadow.kind === "MENTORING", primary.memberId === "A");
        work.get(shadow.shadowMemberId).push(day);
    }
    for (const days of work.values()) {
        days.sort((a, b) => a - b);
        for (let i = 1; i < days.length; i++)
            assert.ok(days[i] - days[i - 1] > 1);
    }
});

test("fixed primary shadow generation preserves the chosen rotation", () => {
    const members = shadowCounterexample();
    const fixed = (rotation) =>
        Array.from({ length: 28 }, (_, index) => ({
            date: `2026-02-${String(index + 1).padStart(2, "0")}`,
            planningMemberId: rotation[index % 4],
        }));
    assert.equal(
        generateShadowsForAssignments(2026, 2, members, fixed("ABCD")).ok,
        false,
    );
    const result = generateShadowsForAssignments(
        2026,
        2,
        members,
        fixed("BCDA"),
    );
    assert.equal(result.ok, true);
    assert.equal(
        result.shadows.find((shadow) => shadow.kind === "TRAINING").date,
        "2026-02-01",
    );
});

test("exhausted complete schedules report shadow infeasibility", () => {
    const members = ["A", "B"].map((id) => ({
        id,
        name: id,
        mode: "UNAVAILABLE",
        dates: [],
        participationMode: "MENTORED",
    }));
    const result = generateSchedule(2026, 2, members);
    assert.equal(result.ok, false);
    assert.equal(result.code, "INFEASIBLE");
});

test("the shared state budget reports a search limit without claiming infeasibility", () => {
    const members = ["A", "B", "C", "D"].map((id) => ({
        id,
        name: id,
        mode: "UNAVAILABLE",
        dates: [],
    }));
    for (const id of ["T", "U"])
        members.push({
            id,
            name: id,
            mode: "AVAILABLE",
            dates: ["2026-02-01"],
            participationMode: "TRAINEE",
            shadowDayCount: 1,
        });
    const result = generateSchedule(2026, 2, members);
    assert.equal(result.ok, false);
    assert.equal(result.code, "SEARCH_LIMIT");
    assert.equal(result.visitedStates, 250_000);
});

test("weekend fairness reaches the balanced optimum in eight and ten weekend months", () => {
    const members = ["A", "B", "C", "D"].map((id) => ({
        id,
        name: id,
        mode: "UNAVAILABLE",
        dates: [],
    }));
    for (const [year, month, expectedWeekends] of [
        [2026, 2, 8],
        [2026, 5, 10],
    ]) {
        const result = generateSchedule(year, month, members);
        assertValidSchedule(result, year, month, members);
        const counts = Object.fromEntries(members.map(({ id }) => [id, 0]));
        for (const assignment of result.assignments) {
            const weekday = new Date(
                `${assignment.date}T00:00:00Z`,
            ).getUTCDay();
            if (weekday === 0 || weekday === 6) counts[assignment.memberId]++;
        }
        assert.equal(
            Object.values(counts).reduce((a, b) => a + b, 0),
            expectedWeekends,
        );
        assert.ok(
            Math.max(...Object.values(counts)) -
                Math.min(...Object.values(counts)) <=
                1,
        );
        assert.deepEqual(
            result,
            generateSchedule(year, month, [...members].reverse()),
        );
    }
});

test("boundary restrictions apply to both edges and mandatory assignments", () => {
    const members = ["A", "B", "C", "D"].map((id) => ({
        id,
        name: id,
        mode: "UNAVAILABLE",
        dates: [],
    }));
    const result = generateSchedule(2027, 1, members, undefined, {
        previous: ["A", "B"],
        next: ["C", "D"],
    });
    assertValidSchedule(result, 2027, 1, members);
    assert.ok(!["A", "B"].includes(result.assignments[0].memberId));
    assert.ok(!["C", "D"].includes(result.assignments.at(-1).memberId));
    const mandatory = [
        ...members,
        {
            id: "M",
            name: "M",
            mode: "AVAILABLE",
            dates: ["2027-01-01", "2027-01-10", "2027-01-20"],
        },
    ];
    const conflict = generateSchedule(2027, 1, mandatory, undefined, {
        previous: ["M"],
    });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.code, "INFEASIBLE");
    assert.match(conflict.message, /mandatory.*2027-01-01.*neighboring/);
});

test("training and mentoring shadows cannot work at a blocked boundary", () => {
    const base = ["A", "B", "C", "D"].map((id) => ({
        id,
        name: id,
        mode: "UNAVAILABLE",
        dates: [],
    }));
    const trainee = {
        id: "T",
        name: "T",
        mode: "AVAILABLE",
        dates: ["2026-02-01"],
        participationMode: "TRAINEE",
        shadowDayCount: 1,
    };
    const training = generateSchedule(2026, 2, [...base, trainee], undefined, {
        previous: ["T"],
    });
    assert.equal(training.ok, false);
    assert.equal(training.code, "INFEASIBLE");
    const members = base.map((member) => ({
        ...member,
        participationMode: member.id === "A" ? "MENTORED" : "NORMAL",
    }));
    const result = generateSchedule(2026, 2, members, undefined, {
        previous: ["B", "C"],
        next: ["D"],
    });
    assertValidSchedule(result, 2026, 2, members);
    for (const shadow of result.shadows) {
        if (shadow.date === "2026-02-01")
            assert.ok(!["B", "C"].includes(shadow.shadowMemberId));
        if (shadow.date === "2026-02-28")
            assert.notEqual(shadow.shadowMemberId, "D");
    }
});

test("combined fairness matches exhaustive search with constrained weekend availability", () => {
    const ids = ["A", "B", "C"];
    const days = 28;
    const flexible = new Set([1, 4, 8, 12, 19, 25]);
    const choices = Array.from({ length: days }, (_, i) => {
        const primary = ids[i % ids.length];
        return flexible.has(i)
            ? [primary, ids[(i + 1) % ids.length]]
            : [primary];
    });
    const date = (i) => `2026-02-${String(i + 1).padStart(2, "0")}`;
    const members = ids.map((id) => ({
        id,
        name: id,
        mode: "AVAILABLE",
        dates: choices.flatMap((options, i) =>
            options.includes(id) ? [date(i)] : [],
        ),
    }));
    const weekend = (i) =>
        [0, 6].includes(new Date(`${date(i)}T00:00:00Z`).getUTCDay());
    const score = (rotation) => {
        const totals = ids.map((id) => rotation.filter((x) => x === id).length);
        const weekends = ids.map(
            (id) => rotation.filter((x, i) => x === id && weekend(i)).length,
        );
        return (
            8 * totals.reduce((sum, n) => sum + Math.abs(3 * n - 28), 0) +
            28 * weekends.reduce((sum, n) => sum + Math.abs(3 * n - 8), 0)
        );
    };
    let optimum = Infinity;
    function enumerate(rotation) {
        const i = rotation.length;
        if (i === days) {
            optimum = Math.min(optimum, score(rotation));
            return;
        }
        for (const id of choices[i])
            if (rotation.at(-1) !== id) enumerate([...rotation, id]);
    }
    enumerate([]);
    const result = generateSchedule(2026, 2, members);
    assertValidSchedule(result, 2026, 2, members);
    assert.equal(
        score(result.assignments.map(({ memberId }) => memberId)),
        optimum,
    );
});
