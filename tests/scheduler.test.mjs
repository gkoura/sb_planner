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
