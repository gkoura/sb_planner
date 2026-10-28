import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Node's type-stripping runner does not resolve the app's TypeScript alias.
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith("@/")) {
            return nextResolve(
                new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url)
                    .href,
                context,
            );
        }
        return nextResolve(specifier, context);
    },
});

const { validateScheduleCsvImport } =
    await import("../src/lib/schedule-import.ts");
const { validateScheduleEdit, parseScheduleInputSnapshot } =
    await import("../src/lib/schedule-edits.ts");

const roster = ["A", "B", "C", "D"].map((id) => ({
    id,
    nameSnapshot: id,
    emailSnapshot: `${id.toLowerCase()}@example.com`,
    roleSnapshot: "ENGINEER",
    participationMode: "NORMAL",
    shadowDayCount: 0,
    availabilitySubmission: { mode: "UNAVAILABLE", dates: [] },
}));
const trainee = {
    id: "T",
    nameSnapshot: "T",
    emailSnapshot: "t@example.com",
    roleSnapshot: "ENGINEER",
    participationMode: "TRAINEE",
    shadowDayCount: 1,
    availabilitySubmission: { mode: "AVAILABLE", dates: ["2026-02-01"] },
};
function rows() {
    return Array.from({ length: 28 }, (_, i) => [
        `2026-02-${String(i + 1).padStart(2, "0")}`,
        `${"abcd"[i % 4]}@example.com`,
        "",
        "",
    ]);
}
function csv(data) {
    return [
        "date,primary_email,shadow_email,shadow_kind",
        ...data.map((row) => row.join(",")),
    ].join("\n");
}
function members() {
    return roster.map((member) => ({
        id: member.id,
        name: member.nameSnapshot,
        ...member.availabilitySubmission,
        participationMode: member.participationMode,
    }));
}
function assignments() {
    return rows().map(([date, email]) => ({
        date,
        planningMemberId: email[0].toUpperCase(),
    }));
}

test("CSV import accepts a valid roster, case-insensitive email, and training pair", () => {
    const data = rows();
    data[0] = ["2026-02-01", "A@EXAMPLE.COM", "t@example.com", "training"];
    const result = validateScheduleCsvImport(csv(data), 2026, 2, [
        ...roster,
        trainee,
    ]);
    assert.equal(
        result.ok,
        true,
        result.ok ? undefined : result.errors.join("; "),
    );
    assert.equal(result.assignments.length, 28);
    assert.deepEqual(
        result.assignments[0].shadows.map(({ shadowMemberId, kind }) => ({
            shadowMemberId,
            kind,
        })),
        [{ shadowMemberId: "T", kind: "TRAINING" }],
    );
    assert.equal(result.fairnessScore, 0);
    assert.deepEqual(result.warnings, []);
});

test("CSV import rejects malformed data, duplicate dates and unknown participants", () => {
    const duplicated = rows();
    duplicated[1][0] = duplicated[0][0];
    const unknown = rows();
    unknown[1][1] = "unknown@example.com";
    for (const [source, pattern] of [
        [
            'date,primary_email,shadow_email,shadow_kind\n"unterminated',
            /unclosed/,
        ],
        [csv(duplicated), /appears more than once/],
        [csv(unknown), /not in this month/],
    ]) {
        const result = validateScheduleCsvImport(source, 2026, 2, roster);
        assert.equal(result.ok, false);
        assert.match(result.errors.join(" "), pattern);
    }
});

test("CSV import rejects unavailable shadows and mismatched trainee counts", () => {
    const data = rows();
    data[0] = ["2026-02-01", "a@example.com", "t@example.com", "TRAINING"];
    const unavailable = {
        ...trainee,
        availabilitySubmission: { mode: "AVAILABLE", dates: ["2026-02-03"] },
    };
    let result = validateScheduleCsvImport(csv(data), 2026, 2, [
        ...roster,
        unavailable,
    ]);
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /unavailable for a shadow duty/);
    result = validateScheduleCsvImport(csv(rows()), 2026, 2, [
        ...roster,
        trainee,
    ]);
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /CSV contains 0/);
});

test("CSV import blocks shadow duties on consecutive dates", () => {
    const data = rows();
    data[0] = ["2026-02-01", "a@example.com", "t@example.com", "TRAINING"];
    data[1] = ["2026-02-02", "b@example.com", "t@example.com", "TRAINING"];
    const member = {
        ...trainee,
        shadowDayCount: 2,
        availabilitySubmission: { mode: "UNAVAILABLE", dates: [] },
    };
    const result = validateScheduleCsvImport(csv(data), 2026, 2, [
        ...roster,
        member,
    ]);
    assert.equal(result.ok, false);
    assert.match(
        result.errors.join(" "),
        /consecutive primary or shadow duties/,
    );
});

test("CSV import treats missing availability as unknown and warns for known primary unavailability", () => {
    const changed = roster.map((member) =>
        member.id === "A"
            ? {
                  ...member,
                  availabilitySubmission: {
                      mode: "UNAVAILABLE",
                      dates: ["2026-02-01"],
                  },
              }
            : member,
    );
    let result = validateScheduleCsvImport(csv(rows()), 2026, 2, changed);
    assert.equal(result.ok, true);
    assert.match(result.warnings.join(" "), /unavailable on 2026-02-01/);
    result = validateScheduleCsvImport(
        csv(rows()),
        2026,
        2,
        changed.map((member) =>
            member.id === "A"
                ? { ...member, availabilitySubmission: null }
                : member,
        ),
    );
    assert.equal(result.ok, true);
    assert.equal(
        result.inputMembers.find((member) => member.id === "A")
            .availabilitySubmitted,
        false,
    );
    assert.deepEqual(result.warnings, []);
});

test("schedule edits distinguish invalid coverage from overridable warnings", () => {
    const invalid = assignments();
    invalid[1].date = invalid[0].date;
    let result = validateScheduleEdit(2026, 2, members(), invalid);
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /more than one assignment/);
    const consecutive = assignments();
    consecutive[1].planningMemberId = "A";
    result = validateScheduleEdit(2026, 2, members(), consecutive);
    assert.equal(result.ok, true);
    assert.match(result.warnings.join(" "), /consecutive days/);
});

test("historical snapshots preserve import availability markers and reject malformed input", () => {
    const snapshot = {
        year: 2026,
        month: 2,
        source: "CSV_IMPORT",
        members: [{ ...members()[0], availabilitySubmitted: false }],
    };
    assert.equal(
        parseScheduleInputSnapshot(JSON.stringify(snapshot)).members[0]
            .availabilitySubmitted,
        false,
    );
    assert.equal(parseScheduleInputSnapshot("{broken"), null);
    assert.equal(
        parseScheduleInputSnapshot(
            JSON.stringify({ ...snapshot, members: [] }),
        ),
        null,
    );
});
