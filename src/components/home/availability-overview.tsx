import { ArrowRight, CalendarDays } from "lucide-react";
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
import { formatMonth } from "@/lib/home/dates";
import type { AvailabilityOverviewMonth } from "@/lib/home/types";

export function AvailabilityOverview({
    months,
}: {
    months: AvailabilityOverviewMonth[];
}) {
    return (
        <section className="grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-primary text-sm font-medium">
                        Your planning months
                    </p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">
                        Availability status
                    </h2>
                </div>
                {months.length ? (
                    <Button
                        nativeButton={false}
                        render={<Link href="/availability" />}
                        size="sm"
                        variant="ghost"
                    >
                        Manage availability <ArrowRight aria-hidden="true" />
                    </Button>
                ) : null}
            </div>
            {months.length ? (
                <div className="grid gap-3">
                    {months.map((month) => (
                        <Card key={month.id}>
                            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4 sm:py-5">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-xl">
                                        <CalendarDays
                                            aria-hidden="true"
                                            className="size-5"
                                        />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="font-semibold">
                                            {formatMonth(
                                                month.year,
                                                month.month,
                                            )}
                                        </p>
                                        <p className="text-muted-foreground text-sm">
                                            {month.submitted
                                                ? "Your availability is on file"
                                                : "Your availability is needed"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {!month.submitted ? (
                                        <Button
                                            nativeButton={false}
                                            render={
                                                <Link href="/availability" />
                                            }
                                            size="sm"
                                        >
                                            Submit dates
                                        </Button>
                                    ) : null}
                                    <Badge
                                        variant={
                                            month.submitted
                                                ? "secondary"
                                                : "outline"
                                        }
                                    >
                                        {month.submitted
                                            ? "Submitted"
                                            : "Action needed"}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="border-dashed shadow-none">
                    <CardHeader>
                        <CardTitle>No open availability yet</CardTitle>
                        <CardDescription>
                            When you are added to a month, it will appear here
                            for you to submit your dates.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}
        </section>
    );
}
