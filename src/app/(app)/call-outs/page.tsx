import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { deleteCallOut } from "@/app/actions/call-outs";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { CallOutMonthGroups } from "@/components/call-outs/month-groups";
import { CreateCallOutForm } from "@/components/call-outs/create-form";
import { getCurrentSession } from "@/lib/auth-guard";
import { athensParts, callOutDuration } from "@/lib/call-outs";
import { prisma } from "@/lib/prisma";

const labels = {
    PRIMARY: "Primary",
    TRAINEE: "Trainee",
    MENTOR: "Mentor",
    SUPPORT: "Support",
    OVERTIME: "Overtime",
};

type CallOutsPageProps = {
    searchParams: Promise<{
        saved?: string;
    }>;
};

function CallOutsLoading() {
    return (
        <div role="status" className="text-muted-foreground py-8 text-sm">
            Loading call-outs...
        </div>
    );
}

async function CallOutsContent({ searchParams }: CallOutsPageProps) {
    const session = await getCurrentSession();

    if (!session) {
        redirect("/sign-in");
    }

    const params = await searchParams;
    const submissionId = randomUUID();

    const entries = await prisma.callOut.findMany({
        where: {
            userId: session.user.id,
        },
        orderBy: {
            startedAt: "desc",
        },
    });

    const entriesByMonth = Map.groupBy(
        entries.map((entry) => ({
            ...entry,
            ...callOutDuration(entry.startedAt, entry.endedAt),
        })),
        (entry) => athensParts(entry.startedAt).slice(0, 7),
    );

    const carryoverMonths = Array.from(
        new Set(
            entries.map((entry) =>
                athensParts(new Date(entry.endedAt.getTime() - 1)).slice(0, 7),
            ),
        ),
    )
        .filter((month) => !entriesByMonth.has(month))
        .sort()
        .reverse();

    return (
        <>
            {session.user.role === "ADMIN" && (
                <section className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-5">
                    <div>
                        <h2 className="font-semibold">Team call-outs</h2>
                        <p className="text-muted-foreground text-sm">
                            Review other members&apos; logs and export team
                            hours.
                        </p>
                    </div>
                    <Button
                        nativeButton={false}
                        render={<Link href="/admin/call-outs" />}
                        variant="outline"
                    >
                        View team call-outs
                    </Button>
                </section>
            )}
            <section className="bg-card rounded-2xl border p-6">
                <div className="grid gap-1">
                    <h2 className="text-xl font-semibold">Log a call-out</h2>

                    <p className="text-muted-foreground text-sm">
                        Standby runs from 09:00 to 09:00 the next day. Choose
                        Support when helping another standby member. Choose
                        Overtime for extra work unrelated to standby.
                    </p>
                </div>

                {params.saved && (
                    <p role="status" className="mt-4 text-sm text-green-700">
                        Call-out saved.
                    </p>
                )}

                <CreateCallOutForm
                    key={submissionId}
                    submissionId={submissionId}
                />
            </section>

            <section className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold">
                            Your call-outs
                        </h2>

                        <p className="text-muted-foreground text-sm">
                            Hours round up once per call-out. Grouped by the
                            Athens start month.
                        </p>
                    </div>

                    <ExportMenu
                        buttonText="Export all"
                        label="Export all call-outs"
                        items={[
                            {
                                format: "daily",
                                label: "Daily hours + formatted CSV",
                                href: "/api/call-outs/export?format=daily",
                            },
                        ]}
                    />
                </div>

                {carryoverMonths.map((month) => (
                    <Button
                        key={month}
                        nativeButton={false}
                        render={
                            <Link
                                href={`/api/call-outs/export?month=${month}&format=daily`}
                            />
                        }
                        variant="outline"
                        className="justify-self-start"
                    >
                        Daily hours + formatted CSV for {month}
                    </Button>
                ))}

                {entries.length === 0 ? (
                    <p className="text-muted-foreground">
                        No call-outs recorded yet.
                    </p>
                ) : (
                    <CallOutMonthGroups
                        groups={Array.from(
                            entriesByMonth,
                            ([month, monthEntries]) => ({
                                month,
                                count: monthEntries.length,
                                totalHours: monthEntries.reduce(
                                    (total, entry) =>
                                        total + entry.roundedHours,
                                    0,
                                ),
                                content: monthEntries.map((entry) => (
                                    <article
                                        key={entry.id}
                                        className="bg-card grid gap-3 rounded-2xl border p-5"
                                    >
                                        <div className="flex flex-wrap justify-between gap-2">
                                            <h3 className="font-semibold">
                                                {labels[entry.role]}
                                            </h3>

                                            <div className="flex gap-2">
                                                <Button
                                                    nativeButton={false}
                                                    render={
                                                        <Link
                                                            href={`/call-outs/${entry.id}/edit`}
                                                        />
                                                    }
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    Edit
                                                    <span className="sr-only">
                                                        {" "}
                                                        call-out from{" "}
                                                        {athensParts(
                                                            entry.startedAt,
                                                        ).slice(0, 10)}
                                                    </span>
                                                </Button>
                                                <form action={deleteCallOut}>
                                                    <input
                                                        type="hidden"
                                                        name="id"
                                                        value={entry.id}
                                                    />

                                                    <Button
                                                        type="submit"
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        Delete
                                                    </Button>
                                                </form>
                                            </div>
                                        </div>

                                        <p className="whitespace-pre-wrap">
                                            {entry.reason}
                                        </p>

                                        <p className="text-muted-foreground text-sm">
                                            {athensParts(
                                                entry.startedAt,
                                            ).replace("T", " ")}{" "}
                                            –{" "}
                                            {athensParts(entry.endedAt).replace(
                                                "T",
                                                " ",
                                            )}{" "}
                                            (Athens)
                                        </p>

                                        <p className="text-sm">
                                            {entry.roundedHours}{" "}
                                            {entry.roundedHours === 1
                                                ? "hour"
                                                : "hours"}{" "}
                                            rounded{" "}
                                            <span className="text-muted-foreground">
                                                ({entry.minutes} minutes worked)
                                            </span>
                                        </p>
                                    </article>
                                )),
                            }),
                        )}
                    />
                )}
            </section>
        </>
    );
}

export default function CallOutsPage({ searchParams }: CallOutsPageProps) {
    return (
        <div className="grid gap-8">
            <section className="grid gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">
                    Call-outs
                </h1>
                <Link
                    href="/call-outs/import"
                    className="text-primary w-fit text-sm font-medium underline"
                >
                    Import call-outs
                </Link>

                <p className="text-muted-foreground">
                    Record your call-outs and export the hours worked. All times
                    are in Europe/Athens.
                </p>
            </section>

            <Suspense fallback={<CallOutsLoading />}>
                <CallOutsContent searchParams={searchParams} />
            </Suspense>
        </div>
    );
}
