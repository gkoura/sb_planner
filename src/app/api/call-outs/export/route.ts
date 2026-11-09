import { getCurrentSession } from "@/lib/auth-guard";
import { athensParts } from "@/lib/call-outs";
import { callOutCsv } from "@/lib/call-out-export";
import { prisma } from "@/lib/prisma";

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
    const filteredEntries = entries.filter(
        (entry) =>
            month === null ||
            athensParts(entry.startedAt).slice(0, 7) === month,
    );
    return new Response(callOutCsv(filteredEntries), {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="call-outs${month ? `-${month}` : ""}.csv"`,
            "Cache-Control": "private, no-store",
        },
    });
}
