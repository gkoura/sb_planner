import { createHash } from "node:crypto";

export type FeedType = "ALL" | "PERSONAL";

type Assignment = {
    date: string;
    nameSnapshot: string;
    planningMember: { userId: string };
    shadows: {
        kind: "TRAINING" | "MENTORING";
        shadowMember: { userId: string };
    }[];
};
type Month = {
    id: string;
    scheduleRuns: { publishedAt: Date | null; assignments: Assignment[] }[];
};

function escapeText(value: string) {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/\r\n|\r|\n/g, "\\n")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,");
}

// RFC 5545 limits physical lines to 75 octets, including the continuation space.
function foldLine(line: string) {
    const lines: string[] = [];
    let part = "";
    let bytes = 0;
    for (const character of line) {
        const size = Buffer.byteLength(character, "utf8");
        if (bytes + size > 75) {
            lines.push(part);
            part = " ";
            bytes = 1;
        }
        part += character;
        bytes += size;
    }
    lines.push(part);
    return lines.join("\r\n");
}

export function renderCalendar(
    months: Month[],
    type: FeedType,
    userId: string,
) {
    const feedIdentity =
        type === "ALL"
            ? "all"
            : `personal-${createHash("sha256").update(userId).digest("hex")}`;
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SB Planner//Standby schedules//EN",
        "CALSCALE:GREGORIAN",
        `X-WR-CALNAME:${type === "ALL" ? "All standby dates" : "My standby dates"}`,
    ];
    for (const month of months) {
        const run = month.scheduleRuns[0];
        if (!run?.publishedAt) continue;
        const stamp = run.publishedAt
            .toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}Z$/, "Z");
        for (const assignment of run.assignments) {
            let summary: string;
            if (type === "ALL") summary = `Standby: ${assignment.nameSnapshot}`;
            else if (assignment.planningMember.userId === userId)
                summary = "Primary standby";
            else {
                const shadow = assignment.shadows.find(
                    (item) => item.shadowMember.userId === userId,
                );
                if (!shadow) continue;
                summary = `${shadow.kind === "TRAINING" ? "Shadowing" : "Mentoring"} ${assignment.nameSnapshot}`;
            }
            lines.push(
                "BEGIN:VEVENT",
                `UID:${feedIdentity}-${month.id}-${assignment.date}@sb-planner`,
                `DTSTAMP:${stamp}`,
                `LAST-MODIFIED:${stamp}`,
                `DTSTART;VALUE=DATE:${assignment.date.replace(/-/g, "")}`,
                `SUMMARY:${escapeText(summary)}`,
                "END:VEVENT",
            );
        }
    }
    lines.push("END:VCALENDAR");
    return lines.map(foldLine).join("\r\n") + "\r\n";
}
