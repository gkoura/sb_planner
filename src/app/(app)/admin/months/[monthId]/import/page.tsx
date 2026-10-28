import { ArrowLeft, FileUp } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ScheduleImportForm } from "@/components/schedules/schedule-import-form";
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

type ImportPageProps = { params: Promise<{ monthId: string }> };

export default function ImportSchedulePage(props: ImportPageProps) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <ImportScheduleContent {...props} />
    </Suspense>
  );
}

async function ImportScheduleContent({ params }: ImportPageProps) {
  await requireAdmin();
  const { monthId } = await params;
  const month = await prisma.planningMonth.findUnique({
    where: { id: monthId },
    include: {
      members: {
        orderBy: { nameSnapshot: "asc" },
        select: {
          id: true,
          nameSnapshot: true,
          emailSnapshot: true,
          roleSnapshot: true,
        },
      },
      scheduleRuns: { select: { id: true }, take: 1, orderBy: { version: "desc" } },
    },
  });
  if (!month) notFound();

  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(month.year, month.month - 1, 1)));

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6">
      <Button
        className="w-fit px-0"
        nativeButton={false}
        render={<Link href={`/admin/months/${month.id}`} />}
        size="sm"
        variant="ghost"
      >
        <ArrowLeft aria-hidden="true" /> Back to {monthLabel}
      </Button>

      <section className="grid gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileUp className="size-5" aria-hidden="true" />
          <span className="text-sm font-medium">Schedule import</span>
          <Badge variant="secondary">{month.status.toLowerCase()}</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Import a schedule</h1>
        <p className="max-w-2xl text-muted-foreground">
          Upload a CSV for {monthLabel}. Review the calendar and any schedule
          exceptions before saving. Past, current, and future planning months
          use the same import flow.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Month participants</CardTitle>
          <CardDescription>
            CSV participants are matched by email to this saved month roster.
            Add anyone missing from the roster before importing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {month.members.length ? (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {month.members.map((member) => (
                <li className="min-w-0 rounded-lg border px-3 py-2" key={member.id}>
                  <p className="truncate text-sm font-medium">{member.nameSnapshot}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.emailSnapshot}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-destructive">Add participants to this month before importing a schedule.</p>
          )}
        </CardContent>
      </Card>

      <ScheduleImportForm
        hasExistingSchedule={month.scheduleRuns.length > 0}
        members={month.members}
        month={month.month}
        monthLabel={monthLabel}
        planningMonthId={month.id}
        year={month.year}
      />
    </div>
  );
}
