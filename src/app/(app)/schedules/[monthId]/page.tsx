import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ScheduleCalendar } from "@/components/schedules/schedule-calendar";
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
        select: { id: true, nameSnapshot: true, roleSnapshot: true },
      },
      scheduleRuns: {
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: "desc" },
        take: 1,
        include: { assignments: { orderBy: { date: "asc" } } },
      },
    },
  });

  if (!month || !month.scheduleRuns[0]) notFound();
  const run = month.scheduleRuns[0];

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <Button className="w-fit px-0" render={<Link href="/schedules" />} size="sm" variant="ghost">
          <ArrowLeft aria-hidden="true" />
          Published schedules
        </Button>
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-5" />
          <span className="text-sm font-medium">Official standby plan</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{formatMonth(month.year, month.month)}</h1>
          <Badge variant="secondary">published</Badge>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Standby schedule</CardTitle>
          <CardDescription>Official version {run.version} · fairness score {run.fairnessScore} · lower is more balanced</CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleCalendar
            assignments={run.assignments}
            members={month.members}
            month={month.month}
            year={month.year}
          />
        </CardContent>
      </Card>
    </div>
  );
}
