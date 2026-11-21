import test from "node:test";
import assert from "node:assert/strict";
import {
    dutyDate,
    parseAthensDateTime,
    callOutDailyHours,
    callOutDuration,
} from "../src/lib/call-outs.ts";

test("rounds the full elapsed duration once across midnight", () => {
    const start = parseAthensDateTime("2026-11-19T23:30");
    const end = parseAthensDateTime("2026-11-20T00:30");
    assert.deepEqual(callOutDuration(start, end), {
        minutes: 60,
        roundedHours: 1,
    });
});

test("derives standby duty dates from the start", () => {
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

test("rounds small durations ending at midnight and same-day partial hours", () => {
    assert.deepEqual(
        callOutDuration(
            parseAthensDateTime("2026-02-01T23:55"),
            parseAthensDateTime("2026-02-02T00:00"),
        ),
        { minutes: 5, roundedHours: 1 },
    );
    assert.equal(
        callOutDuration(
            parseAthensDateTime("2026-02-01T10:00"),
            parseAthensDateTime("2026-02-01T11:30"),
        ).roundedHours,
        2,
    );
});

test("accounts for daylight saving elapsed time and rejects ambiguous or missing local times", () => {
    assert.equal(parseAthensDateTime("2026-03-29T03:30"), null);
    assert.equal(parseAthensDateTime("2026-10-25T03:30"), null);
    assert.equal(
        callOutDuration(
            parseAthensDateTime("2026-03-29T01:00"),
            parseAthensDateTime("2026-03-29T05:00"),
        ).minutes,
        180,
    );
});

test("allocates the call-out total across Athens dates with weekend priority", () => {
    const cases = [
        ["2026-11-06T23:00", "2026-11-07T03:30", [60, 210], [1, 4]],
        ["2026-11-06T23:30", "2026-11-07T00:30", [30, 30], [0, 1]],
        ["2026-11-06T23:30", "2026-11-07T00:45", [30, 45], [1, 1]],
        ["2026-11-06T23:20", "2026-11-07T00:20", [40, 20], [0, 1]],
        ["2026-11-08T23:30", "2026-11-09T00:30", [30, 30], [1, 0]],
        ["2026-11-02T23:45", "2026-11-03T00:30", [15, 30], [0, 1]],
        ["2026-11-02T23:30", "2026-11-03T00:30", [30, 30], [1, 0]],
        ["2026-11-06T23:30", "2026-11-07T00:00", [30], [1]],
        ["2026-10-24T23:30", "2026-10-25T05:00", [30, 360], [1, 6]],
    ];
    for (const [start, end, minutes, hours] of cases) {
        const days = callOutDailyHours(
            parseAthensDateTime(start),
            parseAthensDateTime(end),
        );
        assert.equal(days[0].date, start.slice(0, 10));
        if (days.length > 1) assert.equal(days[1].date, end.slice(0, 10));
        assert.deepEqual(
            days.map((day) => day.minutes),
            minutes,
        );
        assert.deepEqual(
            days.map((day) => day.hours),
            hours,
        );
    }
});
