import { Suspense } from "react";
import { CalendarDays, CircleCheck } from "lucide-react";

import { AvailabilityForm } from "@/components/availability/availability-form";
import { Badge } from "@/components/ui/badge";
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
    }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default function AvailabilityPage() {
    return (
        <div className="grid gap-8">
            <section className="grid gap-2">
                <div className="text-muted-foreground flex items-center gap-2">
                    <CalendarDays aria-hidden="true" className="size-5" />
                    <span className="text-sm font-medium">
                        Your availability
                    </span>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight">
                    Availability
                </h1>

                <p className="text-muted-foreground">
                    Submit the dates you can or cannot cover for each open
                    planning month. You can revise a submission until schedule
                    generation begins.
                </p>
            </section>

            <Suspense fallback={<AvailabilityFallback />}>
                <AvailabilityContent />
            </Suspense>
        </div>
    );
}

function AvailabilityFallback() {
    return (
        <section
            aria-label="Loading availability"
            className="grid gap-5"
            role="status"
        >
            <p className="sr-only">Loading your availability…</p>

            {[1, 2].map((index) => (
                <div
                    key={index}
                    aria-hidden="true"
                    className="bg-muted h-72 animate-pulse rounded-2xl"
                />
            ))}
        </section>
    );
}

async function AvailabilityContent() {
    const session = await getCurrentSession();

    if (!session) {
        return null;
    }

    const memberships = await prisma.planningMember.findMany({
        where: {
            userId: session.user.id,
            planningMonth: {
                status: {
                    in: ["COLLECTING", "READY"],
                },
            },
        },
        include: {
            availabilitySubmission: {
                include: {
                    dates: {
                        select: {
                            date: true,
                        },
                    },
                },
            },
            planningMonth: {
                select: {
                    id: true,
                    month: true,
                    status: true,
                    year: true,
                },
            },
        },
        orderBy: [
            {
                planningMonth: {
                    year: "asc",
                },
            },
            {
                planningMonth: {
                    month: "asc",
                },
            },
        ],
    });

    if (!memberships.length) {
        return (
            <Card>
                <CardContent className="text-muted-foreground py-8 text-sm">
                    There are no open planning months that include you. The
                    admin will open availability collection after creating a
                    month.
                </CardContent>
            </Card>
        );
    }

    return (
        <section aria-label="Open planning months" className="grid gap-5">
            {memberships.map((membership) => {
                const planningMonth = membership.planningMonth;
                const submission = membership.availabilitySubmission;

                return (
                    <Card key={planningMonth.id}>
                        <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="grid gap-1">
                                    <CardTitle>
                                        {formatMonth(
                                            planningMonth.year,
                                            planningMonth.month,
                                        )}
                                    </CardTitle>

                                    <CardDescription>
                                        {submission
                                            ? "You have submitted. You can revise your dates."
                                            : "Submit before the admin generates the schedule."}
                                    </CardDescription>
                                </div>

                                <Badge
                                    variant={submission ? "default" : "outline"}
                                >
                                    {submission ? "Submitted" : "Needed"}
                                </Badge>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {submission ? (
                                <div className="border-primary/20 bg-primary/5 mb-5 flex gap-3 rounded-xl border p-4">
                                    <CircleCheck
                                        aria-hidden="true"
                                        className="text-primary mt-0.5 size-5 shrink-0"
                                    />
                                    <div className="grid gap-1">
                                        <p className="text-sm font-semibold">
                                            Availability submitted
                                        </p>
                                        <p className="text-muted-foreground text-sm">
                                            Your dates are saved. Update the
                                            calendar below and choose “Modify
                                            availability” to save changes.
                                        </p>
                                    </div>
                                </div>
                            ) : null}

                            <AvailabilityForm
                                checkedDates={
                                    submission?.dates.map(({ date }) => date) ??
                                    []
                                }
                                hasSubmitted={Boolean(submission)}
                                key={`${planningMonth.id}:${
                                    submission?.updatedAt.toISOString() ?? "new"
                                }`}
                                mode={submission?.mode ?? "UNAVAILABLE"}
                                planningMonthId={planningMonth.id}
                                month={planningMonth.month}
                                year={planningMonth.year}
                            />
                        </CardContent>
                    </Card>
                );
            })}
        </section>
    );
}
