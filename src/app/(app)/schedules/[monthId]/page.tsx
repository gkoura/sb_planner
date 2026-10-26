import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ScheduleCalendar } from "@/components/schedules/schedule-calendar";
import { ScheduleExportMenu } from "@/components/schedules/schedule-export-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth-guard";
import { parseScheduleWarnings } from "@/lib/schedule-edits";
import { prisma } from "@/lib/prisma";

function formatMonth(year: number, month: number) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default async function PublishedSchedulePage({
  params,
}: {
  params: Promise<{ monthId: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  const { monthId } = await params;

  const month = await prisma.planningMonth.findFirst({
    where: { id: monthId, status: "PUBLISHED" },
    include: {
      members: {
        orderBy: { nameSnapshot: "asc" },
        select: {
          id: true,
          nameSnapshot: true,
          roleSnapshot: true,
          user: { select: { phoneNumber: true } },
        },
      },
      scheduleRuns: {
        where: { publishedAt: { not: null } },
        orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
        take: 1,
        include: {
          assignments: {
            orderBy: { date: "asc" },
            include: {
              shadows: {
                select: {
                  id: true,
                  shadowMemberId: true,
                  kind: true,
                  nameSnapshot: true,
                  roleSnapshot: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!month || !month.scheduleRuns[0]) notFound();
  const run = month.scheduleRuns[0];
  const warnings = parseScheduleWarnings(run.validationWarnings);

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <Button
          className="w-fit px-0"
          nativeButton={false}
          render={<Link href="/schedules" />}
          size="sm"
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" />
          Published schedules
        </Button>
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-5" />
          <span className="text-sm font-medium">Official standby plan</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {formatMonth(month.year, month.month)}
          </h1>
          <Badge variant="secondary">published</Badge>
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <CardTitle>Standby schedule</CardTitle>
            <CardDescription>
              Official version {run.version} · fairness score{" "}
              {run.fairnessScore} · lower is more balanced
            </CardDescription>
          </div>
          <ScheduleExportMenu
            assignments={run.assignments.map((assignment) => ({
              date: assignment.date,
              nameSnapshot: assignment.nameSnapshot,
              planningMemberId: assignment.planningMemberId,
              roleSnapshot: assignment.roleSnapshot,
              shadows: assignment.shadows.map((shadow) => ({
                shadowMemberId: shadow.shadowMemberId,
                nameSnapshot: shadow.nameSnapshot,
                roleSnapshot: shadow.roleSnapshot,
                kind: shadow.kind,
              })),
            }))}
            members={month.members.map((member) => ({
              id: member.id,
              nameSnapshot: member.nameSnapshot,
              roleSnapshot: member.roleSnapshot,
              phoneNumber: member.user.phoneNumber,
            }))}
            month={month.month}
            title={formatMonth(month.year, month.month)}
            version={run.version}
            year={month.year}
          />
        </CardHeader>
        <CardContent>
          {warnings.length || run.revisionReason ? (
            <div
              className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
              role="note"
            >
              <p className="text-sm font-semibold">
                {warnings.length
                  ? "Admin-approved schedule exceptions"
                  : "Admin revision note"}
              </p>
              {run.revisionReason ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {run.revisionReason}
                </p>
              ) : null}
              {warnings.length ? (
                <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <ScheduleCalendar
            assignments={run.assignments}
            members={month.members.map((member) => ({
              id: member.id,
              nameSnapshot: member.nameSnapshot,
              roleSnapshot: member.roleSnapshot,
              phoneNumber: member.user.phoneNumber,
            }))}
            month={month.month}
            year={month.year}
          />
        </CardContent>
      </Card>
    </div>
  );
}
