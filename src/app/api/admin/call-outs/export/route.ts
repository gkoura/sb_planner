import { getCurrentSession } from "@/lib/auth-guard";
import { callOutCsv } from "@/lib/call-out-export";
import { prisma } from "@/lib/prisma";
import {
    filterCallOutMonth,
    parseTeamCallOutFilters,
    teamCallOutWhere,
} from "@/lib/team-call-outs";

export async function GET(request: Request) {
    const session = await getCurrentSession();
    if (!session) return new Response("Unauthorized", { status: 401 });
    if (session.user.role !== "ADMIN")
        return new Response("Forbidden", { status: 403 });

    const params = new URL(request.url).searchParams;
    const { filters, error } = parseTeamCallOutFilters({
        userId:
            params.getAll("userId").length > 1
                ? params.getAll("userId")
                : (params.get("userId") ?? undefined),
        month:
            params.getAll("month").length > 1
                ? params.getAll("month")
                : (params.get("month") ?? undefined),
    });
    if (error) return new Response(error, { status: 400 });

    const entries = await prisma.callOut.findMany({
        where: teamCallOutWhere(filters),
        include: { user: { select: { name: true, email: true } } },
        orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    });
    return new Response(
        callOutCsv(filterCallOutMonth(entries, filters.month), true),
        {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="team-call-outs${filters.userId ? "-member" : ""}${filters.month ? `-${filters.month}` : ""}.csv"`,
                "Cache-Control": "private, no-store",
            },
        },
    );
}
