import { utcCalendarDate } from "@/lib/calendar-date";
import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { CalendarSubscriptions } from "@/components/schedules/calendar-subscriptions";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

function formatMonth(year: number, month: number) {
    return new Intl.DateTimeFormat("en", {
        month: "long",
        timeZone: "UTC",
        year: "numeric",
    }).format(utcCalendarDate(year, month, 1));
}

export default function SchedulesPage() {
    return (
        <div className="grid gap-8">
            <section className="grid gap-2">
                <div className="text-muted-foreground flex items-center gap-2">
                    <CalendarDays aria-hidden="true" className="size-5" />
                    <span className="text-sm font-medium">
                        Official standby plans
                    </span>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight">
                    Published schedules
                </h1>

                <p className="text-muted-foreground">
                    Browse the official plan for this month and previous months.
                </p>
            </section>

            <Suspense fallback={<SchedulesFallback />}>
                <SchedulesContent />
            </Suspense>
        </div>
    );
}

function SchedulesFallback() {
    return (
        <section
            aria-label="Loading published schedules"
            className="grid gap-3"
            role="status"
        >
            <p className="sr-only">Loading schedules…</p>

            {[1, 2, 3].map((index) => (
                <div
                    key={index}
                    aria-hidden="true"
                    className="bg-muted h-24 animate-pulse rounded-2xl"
                />
            ))}
        </section>
    );
}

async function SchedulesContent() {
    const session = await getCurrentSession();

    if (!session) {
        redirect("/sign-in");
    }

    const [subscriptions, months] = await Promise.all([
        prisma.calendarSubscription.findMany({
            where: { userId: session.user.id },
            select: { type: true },
        }),
        prisma.planningMonth.findMany({
            where: { status: "PUBLISHED" },
            orderBy: [{ year: "desc" }, { month: "desc" }],
            include: {
                scheduleRuns: {
                    where: {
                        publishedAt: { not: null },
                    },
                    orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
                    select: {
                        version: true,
                        publishedAt: true,
                        fairnessScore: true,
                    },
                    take: 1,
                },
                _count: {
                    select: { members: true },
                },
            },
        }),
    ]);

    if (!months.length) {
        return (
            <>
                <CalendarSubscriptions
                    activeTypes={subscriptions.map((item) => item.type)}
                />
                <Card>
                    <CardHeader>
                        <CardTitle>No published schedules yet</CardTitle>
                        <CardDescription>
                            When the admin publishes a schedule, it will appear
                            here.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </>
        );
    }

    return (
        <>
            <CalendarSubscriptions
                activeTypes={subscriptions.map((item) => item.type)}
            />
            <section aria-label="Published schedules" className="grid gap-3">
                {months.map((month) => {
                    const run = month.scheduleRuns[0];

                    return (
                        <Link
                            key={month.id}
                            href={`/schedules/${month.id}`}
                            className="focus-visible:outline-ring rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            <Card className="hover:bg-card/70 transition-colors">
                                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4 sm:py-5">
                                    <div>
                                        <p className="font-semibold">
                                            {formatMonth(
                                                month.year,
                                                month.month,
                                            )}
                                        </p>

                                        <p className="text-muted-foreground mt-1 text-sm">
                                            {month._count.members} participants
                                            {run
                                                ? ` · version ${run.version}`
                                                : ""}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {run?.publishedAt ? (
                                            <span className="text-muted-foreground hidden text-sm sm:inline">
                                                Published{" "}
                                                {run.publishedAt.toLocaleDateString()}
                                            </span>
                                        ) : null}

                                        <Badge variant="secondary">
                                            Official
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </section>
        </>
    );
}
