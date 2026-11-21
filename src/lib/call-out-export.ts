import type { CallOut } from "@prisma/client";
import {
    athensParts,
    callOutDailyHours,
    callOutDuration,
} from "@/lib/call-outs";

type ExportEntry = Pick<
    CallOut,
    "reason" | "role" | "dutyDate" | "startedAt" | "endedAt"
> & { user?: { name: string; email: string } };

function cell(value: string | number) {
    const text = String(value);
    return `"${text.replace(/^[\s]*[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
}

export function callOutFormatted(entries: ExportEntry[]) {
    const normal: string[] = [];
    const overtime: string[] = [];
    for (const entry of entries) {
        const start = athensParts(entry.startedAt);
        const end = athensParts(entry.endedAt);
        const date = `${start.slice(8, 10)}/${start.slice(5, 7)}/${start.slice(2, 4)}`;
        const reason = entry.reason.replace(/[\r\n\u2028\u2029]+/g, " ");
        const section = entry.role === "OVERTIME" ? overtime : normal;
        section.push(
            `${date} | ${start.slice(11)} - ${end.slice(11)} | ${reason}`,
        );
    }
    return [
        { title: "Normal call-outs", lines: normal },
        { title: "Overtime", lines: overtime },
    ]
        .map(({ title, lines }) => {
            return `${title}\r\n${lines.length ? lines.join("\r\n") : "No entries."}`;
        })
        .join("\r\n\r\n");
}

export function callOutCsv(entries: ExportEntry[], includeMember = false) {
    const rows = [
        [
            ...(includeMember ? ["member_name", "member_email"] : []),
            "work_date",
            "rounded_hours",
            "minutes_worked",
            "duty_date",
            "duty_role",
            "start_athens",
            "end_athens",
            "reason",
        ],
        ...entries.map((entry) => {
            const { minutes, roundedHours } = callOutDuration(
                entry.startedAt,
                entry.endedAt,
            );
            const start = athensParts(entry.startedAt);
            return [
                ...(includeMember
                    ? [entry.user?.name ?? "", entry.user?.email ?? ""]
                    : []),
                start.slice(0, 10),
                roundedHours,
                minutes,
                entry.role === "SUPPORT" || entry.role === "OVERTIME"
                    ? ""
                    : (entry.dutyDate ?? ""),
                entry.role,
                start,
                athensParts(entry.endedAt),
                entry.reason,
            ];
        }),
    ];
    return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

export function callOutDailyCsv(entries: ExportEntry[], month: string | null) {
    const rows: (string | number)[][] = [
        [
            "work_date",
            "hours_to_log",
            "minutes_worked",
            "duty_role",
            "start_athens",
            "end_athens",
            "reason",
        ],
    ];
    for (const entry of entries) {
        const start = athensParts(entry.startedAt);
        const end = athensParts(entry.endedAt);
        for (const day of callOutDailyHours(entry.startedAt, entry.endedAt)) {
            // Allocate the full entry before filtering by work month.
            if (month !== null && day.date.slice(0, 7) !== month) continue;
            rows.push([
                day.date,
                day.hours,
                day.minutes,
                entry.role,
                start,
                end,
                entry.reason,
            ]);
        }
    }
    const formattedEntries = entries.filter(
        (entry) =>
            month === null ||
            athensParts(entry.startedAt).slice(0, 7) === month,
    );
    const formattedRows = callOutFormatted(formattedEntries).split("\r\n");
    return [
        ...rows.map((row) => row.map(cell).join(",")),
        cell(""),
        cell(""),
        ...formattedRows.map(cell),
    ].join("\r\n");
}
