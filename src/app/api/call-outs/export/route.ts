import { getCurrentSession } from "@/lib/auth-guard";
import { athensParts, splitCallOut } from "@/lib/call-outs";
import { prisma } from "@/lib/prisma";

function cell(value: string | number) {
    const text = String(value);
    return `"${text.replace(/^[\s]*[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
    const session = await getCurrentSession();
    if (!session) return new Response("Unauthorized", { status: 401 });
    const month = new URL(request.url).searchParams.get("month");
    if (month !== null && !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month))
        return new Response("Use a month in YYYY-MM format.", { status: 400 });
    const entries = await prisma.callOut.findMany({
        where: { userId: session.user.id },
        orderBy: { startedAt: "asc" },
    });
    const rows = [
        [
            "work_date",
            "rounded_hours",
            "minutes_worked",
            "duty_date",
            "duty_role",
            "start_athens",
            "end_athens",
            "reason",
        ],
        ...entries
            .filter(
                (entry) =>
                    month === null ||
                    athensParts(entry.startedAt).slice(0, 7) === month,
            )
            .flatMap((entry) =>
                splitCallOut(entry.startedAt, entry.endedAt).map((day) => [
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
    return new Response(
        rows.map((row) => row.map(cell).join(",")).join("\r\n"),
        {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="call-outs${month ? `-${month}` : ""}.csv"`,
                "Cache-Control": "private, no-store",
            },
        },
    );
}
