import { utcCalendarDate } from "@/lib/calendar-date";
import { Suspense } from "react";
import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AvailabilityForm } from "@/components/availability/availability-form";
import { ClearAvailabilityForm } from "@/components/availability/clear-availability-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type AdminAvailabilityPageProps = {
    params: Promise<{ memberId: string; monthId: string }>;
};

function formatMonth(year: number, month: number) {
    return new Intl.DateTimeFormat("en", {
        month: "long",
        timeZone: "UTC",
        year: "numeric",
    }).format(utcCalendarDate(year, month, 1));
}

export default function AdminAvailabilityPage({
    params,
}: AdminAvailabilityPageProps) {
    return (
        <Suspense fallback={<AdminAvailabilityFallback />}>
            <AdminAvailabilityContent params={params} />
        </Suspense>
    );
}

function AdminAvailabilityFallback() {
    return (
        <div
            className="mx-auto grid w-full max-w-5xl gap-6"
            role="status"
            aria-label="Loading participant availability"
        >
            <section className="grid gap-3">
                <div className="bg-muted h-8 w-40 animate-pulse rounded" />
                <div className="bg-muted h-5 w-48 animate-pulse rounded" />
                <div className="bg-muted h-9 w-56 animate-pulse rounded" />
                <div className="bg-muted h-12 w-full max-w-2xl animate-pulse rounded" />
            </section>

            <Card>
                <CardHeader className="grid gap-3">
                    <div className="bg-muted h-6 w-44 animate-pulse rounded" />
                    <div className="bg-muted h-4 w-72 max-w-full animate-pulse rounded" />
                </CardHeader>

                <CardContent>
                    <div className="bg-muted h-96 animate-pulse rounded-xl" />
                </CardContent>
            </Card>
        </div>
    );
}

async function AdminAvailabilityContent({
    params,
}: AdminAvailabilityPageProps) {
    await requireAdmin();

    const { monthId, memberId } = await params;

    const member = await prisma.planningMember.findFirst({
        where: {
            id: memberId,
            planningMonthId: monthId,
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
    });

    if (!member) {
        notFound();
    }

    const month = member.planningMonth;
    const canEdit = ["COLLECTING", "READY"].includes(month.status);
    const submission = member.availabilitySubmission;

    return (
        <div className="mx-auto grid w-full max-w-5xl gap-6">
            <Button
                className="w-fit px-0"
                nativeButton={false}
                render={<Link href={`/admin/months/${month.id}`} />}
                size="sm"
                variant="ghost"
            >
                <ArrowLeft aria-hidden="true" />
                Back to {formatMonth(month.year, month.month)}
            </Button>

            <section className="grid gap-3">
                <div className="text-muted-foreground flex items-center gap-2">
                    <CalendarDays aria-hidden="true" className="size-5" />

                    <span className="text-sm font-medium">
                        Admin-assisted availability
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        {member.nameSnapshot}
                    </h1>

                    <Badge variant={submission ? "secondary" : "outline"}>
                        {submission ? "Submitted" : "Not submitted"}
                    </Badge>
                </div>

                <p className="text-muted-foreground max-w-2xl">
                    Enter or revise availability on this participant’s behalf.
                    The saved submission will be marked as admin-entered.
                </p>
            </section>

            <Card>
                <CardHeader>
                    <CardTitle>
                        {formatMonth(month.year, month.month)}
                    </CardTitle>

                    <CardDescription>
                        {submission
                            ? submission.source === "ADMIN"
                                ? "This availability was last entered by an admin."
                                : "This availability was last entered by the participant."
                            : "No availability has been submitted yet."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="grid gap-5">
                    {canEdit ? (
                        <AvailabilityForm
                            checkedDates={
                                submission?.dates.map(({ date }) => date) ?? []
                            }
                            hasSubmitted={Boolean(submission)}
                            key={`${member.id}:${
                                submission?.updatedAt.toISOString() ?? "new"
                            }`}
                            mode={submission?.mode ?? "UNAVAILABLE"}
                            month={month.month}
                            planningMemberId={member.id}
                            planningMonthId={month.id}
                            submitLabel={
                                submission
                                    ? "Save admin update"
                                    : "Save availability"
                            }
                            year={month.year}
                        />
                    ) : (
                        <p className="bg-muted/60 text-muted-foreground rounded-xl px-4 py-3 text-sm">
                            Availability is locked because this month is no
                            longer collecting submissions.
                        </p>
                    )}

                    {canEdit && submission ? (
                        <div className="border-t pt-5">
                            <p className="text-muted-foreground mb-3 text-sm">
                                Clear this submission to mark{" "}
                                {member.nameSnapshot} as needing availability
                                again.
                            </p>

                            <ClearAvailabilityForm
                                memberName={member.nameSnapshot}
                                planningMemberId={member.id}
                                planningMonthId={month.id}
                            />
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
