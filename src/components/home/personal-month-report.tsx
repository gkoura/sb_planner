import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  daysFromToday,
  formatMonth,
  formatScheduleDate,
} from "@/lib/home/dates";
import type { PersonalSchedule } from "@/lib/home/types";

export function PersonalMonthReport({
  schedule,
  today,
}: {
  schedule: PersonalSchedule | null;
  today: string;
}) {
  const nextDuty = schedule?.duties.find((duty) => duty.date >= today);
  const duties = schedule?.duties ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Your standby days this month</CardTitle>
          <CardDescription className="mt-1">
            {schedule
              ? `${formatMonth(schedule.year, schedule.month)} · ${duties.length} standby ${duties.length === 1 ? "day" : "days"}`
              : "Your shifts will appear here after this month’s schedule is published."}
          </CardDescription>
        </div>
        {schedule ? (
          <Button
            nativeButton={false}
            render={<Link href={`/schedules/${schedule.planningMonthId}`} />}
            variant="outline"
          >
            Full schedule <ArrowRight aria-hidden="true" />
          </Button>
        ) : null}
      </CardHeader>
      {schedule ? (
        <CardContent className="grid gap-5">
          {nextDuty ? (
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
              <p className="text-sm font-medium text-primary">
                {daysFromToday(nextDuty.date, today) === 0
                  ? "You’re on standby today"
                  : "Your next standby day"}
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">
                {formatScheduleDate(nextDuty.date)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {nextDuty.label}
              </p>
              {daysFromToday(nextDuty.date, today) > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  In {daysFromToday(nextDuty.date, today)}{" "}
                  {daysFromToday(nextDuty.date, today) === 1 ? "day" : "days"}
                </p>
              ) : null}
            </div>
          ) : duties.length ? (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              You have no more standby days this month.
            </p>
          ) : (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              You have no standby days assigned this month.
            </p>
          )}

          {duties.length ? (
            <ul
              aria-label="Your standby days this month"
              className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            >
              {duties.map((duty) => {
                const isNext = duty.date === nextDuty?.date;
                return (
                  <li
                    className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${isNext ? "border-primary/40 bg-primary/5" : "bg-background"}`}
                    key={`${duty.date}-${duty.label}`}
                  >
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium">
                        {formatScheduleDate(duty.date)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {duty.label}
                      </span>
                    </span>
                    {isNext ? (
                      <Badge variant="secondary">
                        {duty.date === today ? "Today" : "Next up"}
                      </Badge>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
