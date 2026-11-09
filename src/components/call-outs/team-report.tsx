import type { CallOut } from "@prisma/client";
import { athensParts, splitCallOut } from "@/lib/call-outs";

type Member = { name: string; email: string; isActive: boolean };
type MemberTotal = {
    id: string;
    user: Member;
    count: number;
    totalHours: number;
};
type ReportEntry = Pick<
    CallOut,
    "reason" | "role" | "startedAt" | "endedAt"
> & {
    user: Member;
    days: ReturnType<typeof splitCallOut>;
};

const roleLabels = {
    PRIMARY: "Primary",
    TRAINEE: "Trainee",
    MENTOR: "Mentor",
    SUPPORT: "Support",
};

export function MemberHoursSummary({ members }: { members: MemberTotal[] }) {
    return (
        <section
            className="bg-card overflow-hidden rounded-2xl border"
            aria-label="Hours by member"
        >
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <caption className="px-5 py-4 text-left font-semibold">
                        Hours by member
                    </caption>
                    <thead className="bg-muted/50">
                        <tr>
                            <th scope="col" className="px-5 py-3">
                                Member
                            </th>
                            <th scope="col" className="px-5 py-3 text-right">
                                Call-outs
                            </th>
                            <th scope="col" className="px-5 py-3 text-right">
                                Rounded hours
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {members.map(({ id, user, count, totalHours }) => (
                            <tr key={id}>
                                <th
                                    scope="row"
                                    className="px-5 py-3 font-normal"
                                >
                                    <p className="font-medium wrap-anywhere">
                                        {user.name}
                                        {user.isActive ? "" : " (inactive)"}
                                    </p>
                                    <p className="text-muted-foreground break-all">
                                        {user.email}
                                    </p>
                                </th>
                                <td className="px-5 py-3 text-right tabular-nums">
                                    {count}
                                </td>
                                <td className="px-5 py-3 text-right tabular-nums">
                                    {totalHours}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export function TeamCallOutCard({ entry }: { entry: ReportEntry }) {
    return (
        <article className="grid min-w-0 gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="font-semibold wrap-anywhere">
                        {entry.user.name}
                        {entry.user.isActive ? "" : " (inactive)"}
                    </h3>
                    <p className="text-muted-foreground text-sm break-all">
                        {entry.user.email}
                    </p>
                </div>
                <span className="text-sm font-medium">
                    {roleLabels[entry.role]}
                </span>
            </div>
            <p className="wrap-anywhere whitespace-pre-wrap">{entry.reason}</p>
            <p className="text-muted-foreground text-sm">
                {athensParts(entry.startedAt).replace("T", " ")} –{" "}
                {athensParts(entry.endedAt).replace("T", " ")} (Athens)
            </p>
            <ul className="text-sm">
                {entry.days.map((day) => (
                    <li key={day.date}>
                        {day.date}: {day.roundedHours}{" "}
                        {day.roundedHours === 1 ? "hour" : "hours"}{" "}
                        <span className="text-muted-foreground">
                            ({day.minutes} minutes worked)
                        </span>
                    </li>
                ))}
            </ul>
        </article>
    );
}
