import Link from "next/link";
import { Suspense } from "react";

import { CallOutMonthGroups } from "@/components/call-outs/month-groups";
import {
    MemberHoursSummary,
    TeamCallOutCard,
} from "@/components/call-outs/team-report";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { requireAdmin } from "@/lib/auth-guard";
import { athensParts, splitCallOut } from "@/lib/call-outs";
import { prisma } from "@/lib/prisma";
import {
    filterCallOutMonth,
    parseTeamCallOutFilters,
    teamCallOutExportUrl,
    teamCallOutWhere,
} from "@/lib/team-call-outs";

type TeamCallOutsPageProps = {
    searchParams: Promise<{
        userId?: string | string[];
        month?: string | string[];
    }>;
};

export default function TeamCallOutsPage(props: TeamCallOutsPageProps) {
    return (
        <Suspense
            fallback={
                <p role="status" className="text-muted-foreground">
                    Loading team call-outs…
                </p>
            }
        >
            <TeamCallOutsContent {...props} />
        </Suspense>
    );
}

async function TeamCallOutsContent({ searchParams }: TeamCallOutsPageProps) {
    await requireAdmin();
    const { filters, error } = parseTeamCallOutFilters(await searchParams);
    const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, isActive: true },
        orderBy: [{ name: "asc" }, { email: "asc" }],
    });
    const filterError =
        error ??
        (filters.userId && !users.some((user) => user.id === filters.userId)
            ? "This team member could not be found. Choose another member."
            : undefined);
    const entries = filterError
        ? []
        : filterCallOutMonth(
              await prisma.callOut.findMany({
                  where: teamCallOutWhere(filters),
                  include: {
                      user: {
                          select: { name: true, email: true, isActive: true },
                      },
                  },
                  orderBy: [{ startedAt: "desc" }, { id: "asc" }],
              }),
              filters.month,
          ).map((entry) => {
              const days = splitCallOut(entry.startedAt, entry.endedAt);
              return {
                  ...entry,
                  days,
                  totalHours: days.reduce(
                      (sum, day) => sum + day.roundedHours,
                      0,
                  ),
              };
          });
    const entriesByMember = Map.groupBy(entries, (entry) => entry.userId);
    const entriesByMonth = Map.groupBy(entries, (entry) =>
        athensParts(entry.startedAt).slice(0, 7),
    );
    const totalHours = entries.reduce(
        (sum, entry) => sum + entry.totalHours,
        0,
    );

    return (
        <div className="grid gap-6">
            <header className="grid gap-2">
                <Link
                    href="/call-outs"
                    className="text-primary w-fit text-sm font-medium underline"
                >
                    Back to your call-outs
                </Link>
                <h1 className="text-3xl font-semibold tracking-tight">
                    Team call-outs
                </h1>
                <p className="text-muted-foreground">
                    Review call-outs and worked hours across the team, including
                    inactive members. All times are in Europe/Athens.
                </p>
            </header>

            <form
                key={`${filters.userId ?? "all"}-${filters.month ?? "all"}`}
                action="/admin/call-outs"
                method="get"
                className="bg-card grid gap-4 rounded-2xl border p-5 sm:grid-cols-2"
            >
                <label className="grid gap-1.5 text-sm font-medium">
                    Team member
                    <select
                        name="userId"
                        defaultValue={filters.userId ?? ""}
                        className="border-input bg-background h-10 w-full min-w-0 rounded-md border px-3 text-sm"
                    >
                        <option value="">All members</option>
                        {users.map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.name} · {user.email}
                                {user.isActive ? "" : " (inactive)"}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                    Start month
                    <input
                        type="month"
                        name="month"
                        defaultValue={filters.month ?? ""}
                        min="0001-01"
                        max="9999-12"
                        className="border-input bg-background h-10 w-full min-w-0 rounded-md border px-3 text-sm"
                    />
                </label>
                <p className="text-muted-foreground text-xs sm:col-span-2">
                    Leave the month blank for all months. Overnight call-outs
                    stay in their Athens start month, with all daily hours
                    included. Hours round up separately for each call-out and
                    calendar day.
                </p>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <Button type="submit">Apply filters</Button>
                    <Button
                        nativeButton={false}
                        render={<Link href="/admin/call-outs" />}
                        variant="outline"
                    >
                        Clear filters
                    </Button>
                </div>
            </form>

            {filterError ? (
                <p role="alert" className="text-destructive">
                    {filterError}
                </p>
            ) : (
                <>
                    <section
                        aria-label="Filtered call-out totals"
                        className="flex flex-wrap items-center justify-between gap-4"
                    >
                        <dl className="flex flex-wrap gap-6">
                            <div>
                                <dt className="text-muted-foreground text-sm">
                                    Call-outs
                                </dt>
                                <dd className="text-2xl font-semibold">
                                    {entries.length}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground text-sm">
                                    Rounded hours
                                </dt>
                                <dd className="text-2xl font-semibold">
                                    {totalHours}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground text-sm">
                                    Members with call-outs
                                </dt>
                                <dd className="text-2xl font-semibold">
                                    {entriesByMember.size}
                                </dd>
                            </div>
                        </dl>
                        <ExportMenu
                            buttonText="Export results"
                            label="Export filtered team call-outs"
                            items={[
                                {
                                    format: "csv",
                                    label: "Export results as CSV",
                                    href: teamCallOutExportUrl(filters),
                                },
                            ]}
                        />
                    </section>

                    {entries.length === 0 ? (
                        <p className="text-muted-foreground">
                            No call-outs found for these filters.
                        </p>
                    ) : (
                        <>
                            <MemberHoursSummary
                                members={users
                                    .filter((user) =>
                                        entriesByMember.has(user.id),
                                    )
                                    .map((user) => {
                                        const memberEntries =
                                            entriesByMember.get(user.id)!;
                                        return {
                                            id: user.id,
                                            user,
                                            count: memberEntries.length,
                                            totalHours: memberEntries.reduce(
                                                (sum, entry) =>
                                                    sum + entry.totalHours,
                                                0,
                                            ),
                                        };
                                    })}
                            />
                            <section
                                className="grid gap-3"
                                aria-label="Team call-out history"
                            >
                                <h2 className="text-xl font-semibold">
                                    Call-out history
                                </h2>
                                <CallOutMonthGroups
                                    key={`${filters.userId ?? "all"}-${filters.month ?? "all"}`}
                                    groups={Array.from(
                                        entriesByMonth,
                                        ([month, monthEntries]) => ({
                                            month,
                                            count: monthEntries.length,
                                            totalHours: monthEntries.reduce(
                                                (sum, entry) =>
                                                    sum + entry.totalHours,
                                                0,
                                            ),
                                            exportHref: teamCallOutExportUrl({
                                                ...filters,
                                                month,
                                            }),
                                            content: monthEntries.map(
                                                (entry) => (
                                                    <TeamCallOutCard
                                                        key={entry.id}
                                                        entry={entry}
                                                    />
                                                ),
                                            ),
                                        }),
                                    )}
                                />
                            </section>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
