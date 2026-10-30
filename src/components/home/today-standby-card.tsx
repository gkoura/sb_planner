import { ArrowRight, Clock3, Phone } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatScheduleDate } from "@/lib/home/dates";
import type { TodayStandbyAssignment } from "@/lib/home/types";

export function TodayStandbyCard({
    assignment,
    dutyDate,
}: {
    assignment: TodayStandbyAssignment | null;
    dutyDate: string;
}) {
    return (
        <Card className="border-primary/20 overflow-hidden shadow-sm">
            <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:py-6">
                <div className="flex items-center gap-4">
                    <span className="bg-primary text-primary-foreground grid size-12 shrink-0 place-items-center rounded-2xl">
                        <Clock3 aria-hidden="true" className="size-6" />
                    </span>
                    <div>
                        <p className="text-muted-foreground text-sm font-medium">
                            On standby now · duty date{" "}
                            {formatScheduleDate(dutyDate)}
                        </p>
                        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                            {assignment?.name ??
                                "No published standby assignment"}
                        </h2>
                        <p className="text-muted-foreground mt-1 text-sm">
                            09:00–09:00 the next day · Athens time
                        </p>
                    </div>
                </div>
                {assignment ? (
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {assignment.phoneNumber ? (
                            <Button
                                nativeButton={false}
                                render={
                                    <a href={`tel:${assignment.phoneNumber}`} />
                                }
                                variant="outline"
                            >
                                <Phone aria-hidden="true" />
                                {assignment.phoneNumber}
                            </Button>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                No phone number on file
                            </p>
                        )}
                        <Button
                            nativeButton={false}
                            render={
                                <Link
                                    href={`/schedules/${assignment.planningMonthId}`}
                                />
                            }
                            variant="outline"
                        >
                            View schedule <ArrowRight aria-hidden="true" />
                        </Button>
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        No published assignment exists for this duty date.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
