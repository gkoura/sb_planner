import { CalendarDays } from "lucide-react";

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

export default async function AvailabilityPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const memberships = await prisma.planningMember.findMany({
    where: {
      userId: session.user.id,
      planningMonth: { status: { in: ["COLLECTING", "READY"] } },
    },
    include: {
      availabilitySubmission: { include: { dates: { select: { date: true } } } },
      planningMonth: { select: { id: true, month: true, status: true, year: true } },
    },
    orderBy: [{ planningMonth: { year: "asc" } }, { planningMonth: { month: "asc" } }],
  });

  return (
    <div className="grid gap-8">
      <section className="grid gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="size-5" />
          <span className="text-sm font-medium">Your availability</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Availability</h1>
        <p className="text-muted-foreground">
          Submit the dates you can or cannot cover for each open planning month.
          You can revise a submission until schedule generation begins.
        </p>
      </section>

      {memberships.length > 0 ? (
        <section aria-label="Open planning months" className="grid gap-5">
          {memberships.map((membership) => {
            const planningMonth = membership.planningMonth;
            const daysInMonth = new Date(Date.UTC(planningMonth.year, planningMonth.month, 0)).getUTCDate();
            const days = Array.from({ length: daysInMonth }, (_, index) => {
              const date = `${planningMonth.year}-${String(planningMonth.month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
              const label = new Intl.DateTimeFormat("en", {
                weekday: "short",
                day: "numeric",
                timeZone: "UTC",
              }).format(new Date(`${date}T00:00:00.000Z`));
              return { date, label };
            });
            const submission = membership.availabilitySubmission;

            return (
              <Card key={planningMonth.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="grid gap-1">
                      <CardTitle>{formatMonth(planningMonth.year, planningMonth.month)}</CardTitle>
                      <CardDescription>
                        {submission ? "You have submitted. You can revise your dates." : "Submit before the admin generates the schedule."}
                      </CardDescription>
                    </div>
                    <Badge variant={submission ? "secondary" : "outline"}>
                      {submission ? "submitted" : "needed"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <AvailabilityForm
                    checkedDates={submission?.dates.map(({ date }) => date) ?? []}
                    days={days}
                    key={`${planningMonth.id}:${submission?.updatedAt.toISOString() ?? "new"}`}
                    mode={submission?.mode ?? "AVAILABLE"}
                    planningMonthId={planningMonth.id}
                  />
                </CardContent>
              </Card>
            );
          })}
        </section>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            There are no open planning months that include you. The admin will
            open availability collection after creating a month.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
