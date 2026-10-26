import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

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

export default async function SchedulesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const months = await prisma.planningMonth.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      scheduleRuns: {
        where: { publishedAt: { not: null } },
        orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
        select: { version: true, publishedAt: true, fairnessScore: true },
        take: 1,
      },
      _count: { select: { members: true } },
    },
  });

  return (
    <div className="grid gap-8">
      <section className="grid gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-5" />
          <span className="text-sm font-medium">Official standby plans</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Published schedules</h1>
        <p className="text-muted-foreground">Browse the official plan for this month and previous months.</p>
      </section>

      {months.length ? (
        <section aria-label="Published schedules" className="grid gap-3">
          {months.map((month) => {
            const run = month.scheduleRuns[0];
            return (
              <Link className="rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href={`/schedules/${month.id}`} key={month.id}>
                <Card className="transition-colors hover:bg-card/70">
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4 sm:py-5">
                    <div>
                      <p className="font-semibold">{formatMonth(month.year, month.month)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {month._count.members} participants{run ? ` · version ${run.version}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {run?.publishedAt ? (
                        <span className="hidden text-sm text-muted-foreground sm:inline">
                          Published {run.publishedAt.toLocaleDateString()}
                        </span>
                      ) : null}
                      <Badge variant="secondary">Official</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No published schedules yet</CardTitle>
            <CardDescription>When the admin publishes a schedule, it will appear here.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
