import { ArrowRight, CalendarDays, UsersRound } from "lucide-react";
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
import type { AdminOverview as AdminOverviewData } from "@/lib/home/types";

export function AdminOverview({ data }: { data: AdminOverviewData }) {
    return (
        <section aria-label="Administration" className="grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-primary text-sm font-medium">
                        Administration
                    </p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">
                        Plan the team rotation
                    </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        nativeButton={false}
                        render={<Link href="/admin/months" />}
                        size="sm"
                    >
                        Manage planning months <ArrowRight aria-hidden="true" />
                    </Button>
                    <Button
                        nativeButton={false}
                        render={<Link href="/admin/users" />}
                        size="sm"
                        variant="outline"
                    >
                        Manage team
                    </Button>
                </div>
            </div>

            <Card className="shadow-sm">
                <CardContent className="flex items-center gap-4 py-5">
                    <span className="bg-secondary text-secondary-foreground grid size-11 place-items-center rounded-2xl">
                        <UsersRound aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                        <p className="text-2xl font-semibold tracking-tight">
                            {data.engineerCount}
                        </p>
                        <p className="text-muted-foreground text-sm">
                            Engineer accounts
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
                <div>
                    <p className="text-primary text-sm font-medium">
                        Planning overview
                    </p>
                    <h3 className="mt-1 text-lg font-semibold tracking-tight">
                        Latest months
                    </h3>
                </div>
                <Button
                    nativeButton={false}
                    render={<Link href="/admin/months" />}
                    size="sm"
                    variant="ghost"
                >
                    All months <ArrowRight aria-hidden="true" />
                </Button>
            </div>

            {data.recentMonths.length ? (
                <div className="grid gap-3">
                    {data.recentMonths.map((month) => {
                        const progress = month.memberCount
                            ? Math.round(
                                  (month.submissionCount / month.memberCount) *
                                      100,
                              )
                            : 0;
                        return (
                            <Link
                                className="group focus-visible:outline-ring rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
                                href={`/admin/months/${month.id}`}
                                key={month.id}
                            >
                                <Card className="group-hover:bg-card/70 transition-colors">
                                    <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4 sm:py-5">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-xl">
                                                <CalendarDays
                                                    aria-hidden="true"
                                                    className="size-5"
                                                />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold">
                                                    {formatMonth(
                                                        month.year,
                                                        month.month,
                                                    )}
                                                </p>
                                                <p className="text-muted-foreground mt-0.5 text-sm">
                                                    {month.imported
                                                        ? "Schedule imported · availability not collected"
                                                        : `${month.submissionCount} of ${month.memberCount} availability submissions`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {!month.imported ? (
                                                <div
                                                    aria-label={`${progress}% submitted`}
                                                    className="bg-muted hidden h-1.5 w-24 overflow-hidden rounded-full sm:block"
                                                    role="img"
                                                >
                                                    <div
                                                        className="bg-primary h-full rounded-full"
                                                        style={{
                                                            width: `${progress}%`,
                                                        }}
                                                    />
                                                </div>
                                            ) : null}
                                            <Badge variant="secondary">
                                                {month.status.toLowerCase()}
                                            </Badge>
                                            <ArrowRight
                                                aria-hidden="true"
                                                className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <Card className="border-dashed shadow-none">
                    <CardHeader>
                        <CardTitle>Start with a planning month</CardTitle>
                        <CardDescription>
                            Choose participants, open availability, and create
                            your first standby schedule.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            nativeButton={false}
                            render={<Link href="/admin/months" />}
                        >
                            Create a planning month{" "}
                            <ArrowRight aria-hidden="true" />
                        </Button>
                    </CardContent>
                </Card>
            )}
        </section>
    );
}
