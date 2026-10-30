import test from "node:test";
import assert from "node:assert/strict";
import {
    dutyDate,
    parseAthensDateTime,
    splitCallOut,
} from "../src/lib/call-outs.ts";

test("splits and rounds each calendar day independently", () => {
    const start = parseAthensDateTime("2026-10-21T23:00");
    const end = parseAthensDateTime("2026-10-22T01:30");
    assert.deepEqual(splitCallOut(start, end), [
        { date: "2026-10-21", minutes: 60, roundedHours: 1 },
        { date: "2026-10-22", minutes: 90, roundedHours: 2 },
    ]);
    assert.equal(
        dutyDate(parseAthensDateTime("2026-10-22T00:30")),
        "2026-10-21",
    );
    assert.equal(
        dutyDate(parseAthensDateTime("2026-10-22T09:00")),
        "2026-10-22",
    );
});

test("duty dates use the 09:00 handover only for standby roles", () => {
    for (const role of ["PRIMARY", "TRAINEE", "MENTOR"]) {
        assert.equal(
            dutyDate(parseAthensDateTime("2026-10-30T00:30"), role),
            "2026-10-29",
        );
        assert.equal(
            dutyDate(parseAthensDateTime("2026-10-30T09:00"), role),
            "2026-10-30",
        );
    }
    assert.equal(
        dutyDate(parseAthensDateTime("2026-10-30T00:30"), "SUPPORT"),
        null,
    );
    assert.equal(
        dutyDate(parseAthensDateTime("2026-10-30T10:00"), "SUPPORT"),
        null,
    );
});

test("rounds small durations and does not create an empty midnight segment", () => {
    assert.deepEqual(
        splitCallOut(
            parseAthensDateTime("2026-02-01T23:55"),
            parseAthensDateTime("2026-02-02T00:00"),
        ),
        [{ date: "2026-02-01", minutes: 5, roundedHours: 1 }],
    );
    assert.equal(
        splitCallOut(
            parseAthensDateTime("2026-02-01T10:00"),
            parseAthensDateTime("2026-02-01T11:01"),
        )[0].roundedHours,
        2,
    );
});

test("accounts for daylight saving elapsed time and rejects ambiguous or missing local times", () => {
    assert.equal(parseAthensDateTime("2026-03-29T03:30"), null);
    assert.equal(parseAthensDateTime("2026-10-25T03:30"), null);
    assert.equal(
        splitCallOut(
            parseAthensDateTime("2026-03-29T01:00"),
            parseAthensDateTime("2026-03-29T05:00"),
        )[0].minutes,
        180,
    );
});
