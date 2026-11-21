import { getCurrentSession } from "@/lib/auth-guard";
import { athensParts } from "@/lib/call-outs";
import {
    callOutCsv,
    callOutDailyCsv,
    callOutFormatted,
} from "@/lib/call-out-export";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const session = await getCurrentSession();
    if (!session) return new Response("Unauthorized", { status: 401 });
    const params = new URL(request.url).searchParams;
    const month = params.get("month");
    const format = params.get("format") ?? "csv";
    if (format !== "csv" && format !== "formatted" && format !== "daily")
        return new Response(
            "Choose CSV, Daily hours CSV, or Formatted export.",
            { status: 400 },
        );
    if (month !== null && !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month))
        return new Response("Use a month in YYYY-MM format.", { status: 400 });
    const entries = await prisma.callOut.findMany({
        where: { userId: session.user.id },
        orderBy: { startedAt: "asc" },
    });
    if (format === "daily") {
        return new Response(callOutDailyCsv(entries, month), {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="call-outs${month ? `-${month}` : ""}-daily-hours.csv"`,
                "Cache-Control": "private, no-store",
            },
        });
    }
    const filteredEntries = entries.filter(
        (entry) =>
            month === null ||
            athensParts(entry.startedAt).slice(0, 7) === month,
    );
    const formatted = format === "formatted";
    return new Response(
        formatted
            ? callOutFormatted(filteredEntries)
            : callOutCsv(filteredEntries),
        {
            headers: {
                "Content-Type": formatted
                    ? "text/plain; charset=utf-8"
                    : "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="call-outs${month ? `-${month}` : ""}${formatted ? "-formatted.txt" : ".csv"}"`,
                "Cache-Control": "private, no-store",
            },
        },
    );
}
