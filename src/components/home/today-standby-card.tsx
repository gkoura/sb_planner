import { ArrowRight, Clock3, Phone } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatScheduleDate } from "@/lib/home/dates";
import type { TodayStandbyAssignment } from "@/lib/home/types";

export function TodayStandbyCard({
  assignment,
  today,
}: {
  assignment: TodayStandbyAssignment | null;
  today: string;
}) {
  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:py-6">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Clock3 aria-hidden="true" className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              On standby today · {formatScheduleDate(today)}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {assignment?.name ?? "No published standby assignment"}
            </h2>
          </div>
        </div>
        {assignment ? (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {assignment.phoneNumber ? (
              <Button
                nativeButton={false}
                render={<a href={`tel:${assignment.phoneNumber}`} />}
                variant="outline"
              >
                <Phone aria-hidden="true" />
                {assignment.phoneNumber}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                No phone number on file
              </p>
            )}
            <Button
              nativeButton={false}
              render={
                <Link href={`/schedules/${assignment.planningMonthId}`} />
              }
              variant="outline"
            >
              View schedule <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The team schedule for today hasn’t been published.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
