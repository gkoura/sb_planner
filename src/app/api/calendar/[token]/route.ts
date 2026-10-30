import { createHash } from "node:crypto";

import { renderCalendar } from "@/lib/calendar-feed";
import { prisma } from "@/lib/prisma";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token } = await params;
    const headers = {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
    };
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
        return new Response("Not found", { status: 404, headers });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const subscription = await prisma.calendarSubscription.findUnique({
        where: { tokenHash },
        select: { userId: true, type: true },
    });
    if (!subscription)
        return new Response("Not found", { status: 404, headers });
    const months = await prisma.planningMonth.findMany({
        where: { status: "PUBLISHED" },
        orderBy: [{ year: "asc" }, { month: "asc" }],
        select: {
            id: true,
            scheduleRuns: {
                where: { publishedAt: { not: null } },
                orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
                take: 1,
                select: {
                    publishedAt: true,
                    assignments: {
                        orderBy: { date: "asc" },
                        select: {
                            date: true,
                            nameSnapshot: true,
                            planningMember: { select: { userId: true } },
                            shadows: {
                                select: {
                                    kind: true,
                                    shadowMember: { select: { userId: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    return new Response(
        renderCalendar(months, subscription.type, subscription.userId),
        {
            headers: {
                ...headers,
                "Content-Type": "text/calendar; charset=utf-8",
            },
        },
    );
}
