import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GenerateScheduleForm } from "@/components/schedules/generate-schedule-form";
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

function formatMonth(year: number, month: number) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export default async function PlanningMonthPage({
  params,
}: {
  params: Promise<{ monthId: string }>;
}) {
  await requireAdmin();
  const { monthId } = await params;
  const month = await prisma.planningMonth.findUnique({
    where: { id: monthId },
    include: {
      members: {
        orderBy: { nameSnapshot: "asc" },
        include: { availabilitySubmission: { select: { id: true } } },
      },
      scheduleRuns: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          assignments: { orderBy: { date: "asc" } },
        },
      },
    },
  });

  if (!month) notFound();

  const submittedCount = month.members.filter(
    (member) => member.availabilitySubmission,
  ).length;
  const scheduleRun = month.scheduleRuns[0];
  const assignmentsByMember = new Map<string, number>();
  for (const assignment of scheduleRun?.assignments ?? []) {
    assignmentsByMember.set(
      assignment.planningMemberId,
      (assignmentsByMember.get(assignment.planningMemberId) ?? 0) + 1,
    );
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <Button
          className="w-fit px-0"
          render={<Link href="/admin/months" />}
          size="sm"
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" />
          Planning months
        </Button>
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="size-5" />
          <span className="text-sm font-medium">Schedule review</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {formatMonth(month.year, month.month)}
          </h1>
          <Badge variant="secondary">{month.status.toLowerCase()}</Badge>
        </div>
        <p className="text-muted-foreground">
          {submittedCount} of {month.members.length} participants submitted availability.
        </p>
      </section>

      {scheduleRun ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Candidate schedule</CardTitle>
              <CardDescription>
                Version {scheduleRun.version} · generated {formatDate(scheduleRun.generatedAt.toISOString().slice(0, 10))}
                {" · "}fairness score {scheduleRun.fairnessScore} (lower is more balanced)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 font-medium">Assigned engineer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRun.assignments.map((assignment) => (
                      <tr className="border-b last:border-0" key={assignment.id}>
                        <td className="py-2 pr-4">{formatDate(assignment.date)}</td>
                        <td className="py-2">
                          {assignment.nameSnapshot}
                          {assignment.roleSnapshot === "ADMIN" ? (
                            <span className="ml-2 text-xs text-muted-foreground">admin</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workload balance</CardTitle>
              <CardDescription>Assigned days compared with each participant’s submitted availability.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 sm:grid-cols-2">
                {month.members.map((member) => (
                  <li className="flex items-center justify-between gap-4 rounded-lg border p-3" key={member.id}>
                    <span className="truncate text-sm font-medium">{member.nameSnapshot}</span>
                    <Badge variant="outline">{assignmentsByMember.get(member.id) ?? 0} days</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{month.status === "READY" ? "Ready to generate" : "Schedule not ready"}</CardTitle>
            <CardDescription>
              {month.status === "READY"
                ? "Everyone has submitted. Generate a candidate to review the daily assignments and workload."
                : "The candidate schedule becomes available after every participant submits availability."}
            </CardDescription>
          </CardHeader>
          {month.status === "READY" ? (
            <CardContent>
              <GenerateScheduleForm planningMonthId={month.id} />
            </CardContent>
          ) : null}
        </Card>
      )}
    </div>
  );
}
