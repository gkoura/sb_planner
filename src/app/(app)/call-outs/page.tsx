
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { createCallOut, deleteCallOut } from "@/app/actions/call-outs";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth-guard";
import { athensParts, splitCallOut } from "@/lib/call-outs";
import { prisma } from "@/lib/prisma";

const labels = {
    PRIMARY: "Primary",
    TRAINEE: "Trainee",
    MENTOR: "Mentor",
    SUPPORT: "Support",
};

type CallOutsPageProps = {
    searchParams: Promise<{ error?: string; saved?: string }>;
};

export default function CallOutsPage({
    searchParams,
}: CallOutsPageProps) {
    return (
        <div className="grid gap-8">
            <section className="grid gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">
                    Call-outs
                </h1>
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

function CallOutsLoading() {
    return (
        <div
            role="status"
            className="text-muted-foreground py-8 text-sm"
        >
            Loading call-outs...
        </div>
    );
}

async function CallOutsContent({
    searchParams,
}: CallOutsPageProps) {
    const session = await getCurrentSession();

    if (!session) {
        redirect("/sign-in");
    }

    const params = await searchParams;

    const entries = await prisma.callOut.findMany({
        where: { userId: session.user.id },
        orderBy: { startedAt: "desc" },
    });

    return (
        <>
            <section className="bg-card rounded-2xl border p-6">
                <h2 className="text-xl font-semibold">Log a call-out</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    Standby runs from 09:00 to 09:00 the next day. Choose
                    support when helping outside your assigned duty.
                </p>

                {params.error && (
                    <p role="alert" className="text-destructive mt-4">
                        Check the reason, role and times. End must be after
                        start, within seven days. Times during a daylight-saving
                        clock change may be ambiguous or unavailable.
                    </p>
                )}

                {params.saved && (
                    <p role="status" className="mt-4 text-green-700">
                        Call-out saved.
                    </p>
                )}

                <form action={createCallOut} className="mt-5 grid gap-4">
                    <label className="grid gap-1.5 text-sm font-medium">
                        Reason
                        <textarea
                            name="reason"
                            required
                            maxLength={2000}
                            rows={3}
                            className="border-input bg-background rounded-md border p-2"
                        />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <label className="grid gap-1.5 text-sm font-medium">
                            Duty role
                            <select
                                name="role"
                                required
                                className="border-input bg-background rounded-md border p-2"
                            >
                                <option value="PRIMARY">Primary</option>
                                <option value="TRAINEE">
                                    Trainee (shadow)
                                </option>
                                <option value="MENTOR">Mentor</option>
                                <option value="SUPPORT">Support</option>
                            </select>
                        </label>

                        <label className="grid gap-1.5 text-sm font-medium">
                            Start
                            <input
                                name="start"
                                type="datetime-local"
                                required
                                className="border-input bg-background rounded-md border p-2"
                            />
                        </label>

                        <label className="grid gap-1.5 text-sm font-medium">
                            End
                            <input
                                name="end"
                                type="datetime-local"
                                required
                                className="border-input bg-background rounded-md border p-2"
                            />
                        </label>
                    </div>

                    <Button type="submit" className="w-fit">
                        Save call-out
                    </Button>
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
                            calendar day.
                        </p>
                    </div>

                    <a
                        href="/api/call-outs/export"
                        className="text-primary font-medium underline"
                    >
                        Download CSV
                    </a>
                </div>

                {entries.length === 0 ? (
                    <p className="text-muted-foreground">
                        No call-outs recorded yet.
                    </p>
                ) : (
                    entries.map((entry) => (
                        <article
                            key={entry.id}
                            className="bg-card grid gap-3 rounded-2xl border p-5"
                        >
                            <div className="flex flex-wrap justify-between gap-2">
                                <h3 className="font-semibold">
                                    {labels[entry.role]} · standby{" "}
                                    {entry.dutyDate}
                                </h3>

                                <form action={deleteCallOut}>
                                    <input
                                        type="hidden"
                                        name="id"
                                        value={entry.id}
                                    />
                                    <Button variant="outline" size="sm">
                                        Delete
                                    </Button>
                                </form>
                            </div>

                            <p className="whitespace-pre-wrap">
                                {entry.reason}
                            </p>

                            <p className="text-muted-foreground text-sm">
                                {athensParts(entry.startedAt).replace("T", " ")}{" "}
                                – {athensParts(entry.endedAt).replace("T", " ")}{" "}
                                (Athens)
                            </p>

                            <ul className="text-sm">
                                {splitCallOut(
                                    entry.startedAt,
                                    entry.endedAt,
                                ).map((day) => (
                                    <li key={day.date}>
                                        {day.date}: {day.roundedHours}{" "}
                                        {day.roundedHours === 1
                                            ? "hour"
                                            : "hours"}{" "}
                                        <span className="text-muted-foreground">
                                            ({day.minutes} minutes worked)
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </article>
                    ))
                )}
            </section>
        </>
    );
}
