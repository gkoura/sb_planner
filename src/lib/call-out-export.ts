import type { CallOut } from "@prisma/client";
import { athensParts, splitCallOut } from "@/lib/call-outs";

type ExportEntry = Pick<
    CallOut,
    "reason" | "role" | "dutyDate" | "startedAt" | "endedAt"
> & { user?: { name: string; email: string } };

function cell(value: string | number) {
    const text = String(value);
    return `"${text.replace(/^[\s]*[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
}

export function callOutFormatted(entries: ExportEntry[]) {
    return entries
        .map((entry) => {
            const start = athensParts(entry.startedAt);
            const end = athensParts(entry.endedAt);
            const date = `${start.slice(8, 10)}/${start.slice(5, 7)}/${start.slice(2, 4)}`;
            const reason = entry.reason.replace(/[\r\n\u2028\u2029]+/g, " ");
            return `${date} | ${start.slice(11)} - ${end.slice(11)} | ${reason}`;
        })
        .join("\r\n");
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
        ...entries.flatMap((entry) =>
            splitCallOut(entry.startedAt, entry.endedAt).map((day) => [
                ...(includeMember
                    ? [entry.user?.name ?? "", entry.user?.email ?? ""]
                    : []),
                day.date,
                day.roundedHours,
                day.minutes,
                entry.role === "SUPPORT" ? "" : (entry.dutyDate ?? ""),
                entry.role,
                athensParts(entry.startedAt),
                athensParts(entry.endedAt),
                entry.reason,
            ]),
        ),
    ];
    return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
