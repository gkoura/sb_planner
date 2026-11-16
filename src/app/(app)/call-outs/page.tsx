import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { createCallOut, deleteCallOut } from "@/app/actions/call-outs";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { CallOutMonthGroups } from "@/components/call-outs/month-groups";
import { SaveCallOutButton } from "@/components/call-outs/save-button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { getCurrentSession } from "@/lib/auth-guard";
import { athensParts, splitCallOut } from "@/lib/call-outs";
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
        error?: string;
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

    const entries = await prisma.callOut.findMany({
        where: {
            userId: session.user.id,
        },
        orderBy: {
            startedAt: "desc",
        },
    });

    const entriesByMonth = Map.groupBy(entries, (entry) =>
        athensParts(entry.startedAt).slice(0, 7),
    );

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

                {params.error && (
                    <p role="alert" className="text-destructive mt-4 text-sm">
                        {params.error === "schedule" ? (
                            "Your role must match your assignment on the derived duty date in the latest published schedule. Before 09:00 Athens, that is the previous date. Support is only available when you have no scheduled duty for that date. A published schedule is required for primary, trainee, and mentor call-outs. Overtime is unrelated to standby and does not require a scheduled duty."
                        ) : (
                            <>
                                Check the reason, role and times. End must be
                                after start, within seven days. Times during a
                                daylight-saving clock change may be ambiguous or
                                unavailable.
                            </>
                        )}
                    </p>
                )}

                {params.saved && (
                    <p role="status" className="mt-4 text-sm text-green-700">
                        Call-out saved.
                    </p>
                )}

                <form action={createCallOut} className="mt-6 grid gap-5">
                    <input
                        type="hidden"
                        name="submissionId"
                        value={randomUUID()}
                    />
                    <label className="grid gap-1.5 text-sm font-medium">
                        Reason
                        <textarea
                            name="reason"
                            required
                            maxLength={2000}
                            rows={3}
                            placeholder={
                                "Describe the reason for the call-out...\n" +
                                "e.g. Job: P.JW.GR.CMS.COSMOS.MASSISSKA.MASS_KA_8.BAT Ended NOT Ok"
                            }
                            className="border-input bg-background placeholder:text-muted-foreground rounded-md border p-3 text-sm"
                        />
                    </label>

                    <label className="grid gap-1.5 text-sm font-medium">
                        Duty role
                        <select
                            name="role"
                            required
                            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                        >
                            <option value="PRIMARY">Primary</option>

                            <option value="TRAINEE">Trainee (shadow)</option>

                            <option value="MENTOR">Mentor</option>

                            <option value="SUPPORT">Support</option>
                            <option value="OVERTIME">Overtime</option>
                        </select>
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <DateTimePicker name="start" label="Start" />

                        <DateTimePicker name="end" label="End" />
                    </div>

                    <p className="text-muted-foreground text-xs">
                        All dates and times are interpreted in Europe/Athens
                        (24-hour format).
                    </p>

                    <div className="flex justify-end border-t pt-5">
                        <SaveCallOutButton />
                    </div>
                </form>
            </section>

            <section className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold">
                            Your call-outs
                        </h2>

                        <p className="text-muted-foreground text-sm">
                            Each call-out is rounded up separately for each
                            calendar day. Grouped by the Athens start month.
                        </p>
                    </div>

                    <ExportMenu
                        buttonText="Export all"
                        label="Export all call-outs"
                        items={[
                            {
                                format: "csv",
                                label: "Export all as CSV",
                                href: "/api/call-outs/export",
                            },
                            {
                                format: "formatted",
                                label: "Formatted",
                                href: "/api/call-outs/export?format=formatted",
                            },
                        ]}
                    />
                </div>

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
                                        total +
                                        splitCallOut(
                                            entry.startedAt,
                                            entry.endedAt,
                                        ).reduce(
                                            (hours, day) =>
                                                hours + day.roundedHours,
                                            0,
                                        ),
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

                                        <ul className="text-sm">
                                            {splitCallOut(
                                                entry.startedAt,
                                                entry.endedAt,
                                            ).map((day) => (
                                                <li key={day.date}>
                                                    {day.date}:{" "}
                                                    {day.roundedHours}{" "}
                                                    {day.roundedHours === 1
                                                        ? "hour"
                                                        : "hours"}{" "}
                                                    <span className="text-muted-foreground">
                                                        ({day.minutes} minutes
                                                        worked)
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
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
