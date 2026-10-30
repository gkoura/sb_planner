import { buildMonthWeeks } from "@/lib/month-calendar";
import { SCHEDULE_COLORS } from "@/lib/schedule-colors";

type ScheduleMember = {
    id: string;
    nameSnapshot: string;
    roleSnapshot: string;
    phoneNumber?: string | null;
};

type ScheduleAssignment = {
    date: string;
    planningMemberId: string;
    nameSnapshot: string;
    roleSnapshot: string;
    shadows?: {
        id: string;
        shadowMemberId: string;
        nameSnapshot: string;
        kind: "TRAINING" | "MENTORING";
    }[];
};

const WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00.000Z`));
}

export function ScheduleCalendar({
    year,
    month,
    members,
    assignments,
    today,
    onSelectDate,
    selectedDates = [],
    isDateLocked,
    disabled = false,
    showLegend = true,
}: {
    year: number;
    month: number;
    members: ScheduleMember[];
    assignments: ScheduleAssignment[];
    /** ISO date in the team's operational timezone. */
    today?: string;
    onSelectDate?: (date: string) => void;
    selectedDates?: string[];
    isDateLocked?: (date: string) => boolean;
    disabled?: boolean;
    showLegend?: boolean;
}) {
    const Cell = onSelectDate ? "button" : "div";
    const weeks = buildMonthWeeks(year, month);
    const isCurrentMonth = today?.startsWith(
        `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`,
    );
    const colorsByMemberId = new Map(
        members.map((member, index) => [
            member.id,
            SCHEDULE_COLORS[index % SCHEDULE_COLORS.length],
        ]),
    );
    const assignmentsByDate = new Map(
        assignments.map((assignment) => [assignment.date, assignment]),
    );
    const assignmentsByMember = new Map<string, number>();
    const shadowsByMember = new Map<string, number>();
    for (const assignment of assignments) {
        assignmentsByMember.set(
            assignment.planningMemberId,
            (assignmentsByMember.get(assignment.planningMemberId) ?? 0) + 1,
        );
        for (const shadow of assignment.shadows ?? []) {
            shadowsByMember.set(
                shadow.shadowMemberId,
                (shadowsByMember.get(shadow.shadowMemberId) ?? 0) + 1,
            );
        }
    }

    return (
        <>
            <div className="bg-background overflow-hidden rounded-xl border p-1 sm:p-3">
                <table
                    aria-label="Daily standby assignments"
                    className="w-full table-fixed border-separate border-spacing-1 text-left"
                >
                    <thead>
                        <tr>
                            {WEEKDAYS.map((weekday) => (
                                <th
                                    className="text-muted-foreground pb-2 text-center text-[0.65rem] font-semibold tracking-wide uppercase sm:text-xs"
                                    key={weekday}
                                    scope="col"
                                >
                                    <span className="sm:hidden">
                                        {weekday.slice(0, 1)}
                                    </span>
                                    <span className="hidden sm:inline">
                                        {weekday.slice(0, 3)}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {weeks.map((week, weekIndex) => (
                            <tr key={weekIndex}>
                                {week.map((cell, weekdayIndex) => {
                                    if (!cell)
                                        return (
                                            <td
                                                aria-hidden="true"
                                                className="p-0"
                                                key={`${weekIndex}-${weekdayIndex}`}
                                            />
                                        );
                                    const assignment = assignmentsByDate.get(
                                        cell.date,
                                    );
                                    const isToday = cell.date === today;
                                    const isPast = Boolean(
                                        today &&
                                        isCurrentMonth &&
                                        cell.date < today,
                                    );
                                    const color = assignment
                                        ? colorsByMemberId.get(
                                              assignment.planningMemberId,
                                          )
                                        : undefined;
                                    const initials = assignment?.nameSnapshot
                                        .trim()
                                        .split(/\s+/)
                                        .slice(0, 2)
                                        .map((part) => part[0])
                                        .join("")
                                        .toUpperCase();

                                    return (
                                        <td
                                            aria-label={
                                                assignment
                                                    ? `${isToday ? "Today, " : ""}${formatDate(cell.date)}: ${assignment.nameSnapshot}${assignment.roleSnapshot === "ADMIN" ? ", admin" : ""}${(assignment.shadows ?? []).map((shadow) => `; ${shadow.kind === "TRAINING" ? "shadowing" : "mentoring"} ${shadow.nameSnapshot}`).join("")}`
                                                    : `${isToday ? "Today, " : ""}${formatDate(cell.date)}: unassigned`
                                            }
                                            aria-current={
                                                isToday ? "date" : undefined
                                            }
                                            className="p-0 align-top"
                                            key={cell.date}
                                        >
                                            <Cell
                                                type={
                                                    onSelectDate
                                                        ? "button"
                                                        : undefined
                                                }
                                                onClick={
                                                    onSelectDate
                                                        ? () =>
                                                              onSelectDate(
                                                                  cell.date,
                                                              )
                                                        : undefined
                                                }
                                                disabled={
                                                    onSelectDate
                                                        ? disabled ||
                                                          isDateLocked?.(
                                                              cell.date,
                                                          )
                                                        : undefined
                                                }
                                                aria-label={
                                                    onSelectDate
                                                        ? `${formatDate(cell.date)}: ${assignment?.nameSnapshot ?? "Unassigned"}${(assignment?.shadows ?? []).map((shadow) => `; ${shadow.kind === "TRAINING" ? "Shadow" : "Mentor"}: ${shadow.nameSnapshot}`).join("")}${isDateLocked?.(cell.date) ? ", past date locked" : ", click to edit"}`
                                                        : undefined
                                                }
                                                aria-pressed={
                                                    onSelectDate
                                                        ? selectedDates.includes(
                                                              cell.date,
                                                          )
                                                        : undefined
                                                }
                                                className={`focus-visible:outline-ring w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${selectedDates.includes(cell.date) ? "ring-primary ring-2 ring-offset-2" : ""} relative flex min-h-14 flex-col justify-between gap-1 rounded-lg border p-1.5 sm:min-h-24 sm:p-2.5 ${isPast ? "opacity-60 grayscale" : ""} ${isToday ? "ring-primary ring-offset-background z-10 ring-2 ring-offset-2" : ""}`}
                                                style={
                                                    color
                                                        ? {
                                                              backgroundColor:
                                                                  color.background,
                                                              borderColor: `${color.foreground}55`,
                                                          }
                                                        : undefined
                                                }
                                                title={`${assignment?.nameSnapshot ?? "Unassigned"}${isToday ? " · Today" : ""}`}
                                            >
                                                <span className="flex items-start justify-between gap-1">
                                                    <span
                                                        className="text-[0.65rem] font-semibold sm:text-xs"
                                                        style={{
                                                            color:
                                                                color?.foreground ??
                                                                "var(--muted-foreground)",
                                                        }}
                                                    >
                                                        {cell.day}
                                                    </span>
                                                    {isToday ? (
                                                        <span className="bg-primary text-primary-foreground rounded px-1 py-0.5 text-[0.5rem] font-bold tracking-wide uppercase sm:text-[0.55rem]">
                                                            Today
                                                        </span>
                                                    ) : null}
                                                </span>
                                                {assignment ? (
                                                    <>
                                                        <span
                                                            className="my-1 grid size-6 place-items-center self-center rounded-full text-[0.6rem] font-bold sm:hidden"
                                                            style={{
                                                                backgroundColor:
                                                                    color?.foreground,
                                                                color: color?.background,
                                                            }}
                                                        >
                                                            {initials}
                                                        </span>
                                                        <span
                                                            className="hidden truncate text-[0.7rem] leading-tight font-semibold sm:block"
                                                            style={{
                                                                color: color?.foreground,
                                                            }}
                                                        >
                                                            {
                                                                assignment.nameSnapshot
                                                            }
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground text-[0.6rem]">
                                                        Open
                                                    </span>
                                                )}
                                                {(
                                                    assignment?.shadows ?? []
                                                ).map((shadow) => {
                                                    const shadowColor =
                                                        colorsByMemberId.get(
                                                            shadow.shadowMemberId,
                                                        );
                                                    const label =
                                                        shadow.kind ===
                                                        "TRAINING"
                                                            ? "Shadow"
                                                            : "Mentor";
                                                    return (
                                                        <span
                                                            className="truncate rounded-md px-1 py-0.5 text-[0.55rem] leading-tight font-semibold sm:text-[0.65rem]"
                                                            key={shadow.id}
                                                            style={
                                                                shadowColor
                                                                    ? {
                                                                          backgroundColor:
                                                                              shadowColor.foreground,
                                                                          color: shadowColor.background,
                                                                      }
                                                                    : undefined
                                                            }
                                                            title={`${label}: ${shadow.nameSnapshot}`}
                                                        >
                                                            <span className="sm:hidden">
                                                                {label}:{" "}
                                                                {shadow.nameSnapshot
                                                                    .slice(0, 1)
                                                                    .toUpperCase()}
                                                            </span>
                                                            <span className="hidden sm:inline">
                                                                {label}:{" "}
                                                                {
                                                                    shadow.nameSnapshot
                                                                }
                                                            </span>
                                                        </span>
                                                    );
                                                })}
                                            </Cell>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {showLegend ? (
                <ul
                    aria-label="Participant colors and total primary and shadow duties"
                    className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                >
                    {members.map((member) => {
                        const color = colorsByMemberId.get(member.id);
                        return (
                            <li
                                className="bg-background grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2"
                                key={member.id}
                            >
                                <span
                                    aria-hidden="true"
                                    className="size-3 shrink-0 rounded-sm"
                                    style={{
                                        backgroundColor: color?.foreground,
                                    }}
                                />
                                <span className="min-w-0 truncate text-sm font-medium">
                                    {member.nameSnapshot}
                                </span>
                                {member.phoneNumber ? (
                                    <a
                                        className="text-primary col-start-2 w-fit text-xs underline-offset-4 hover:underline"
                                        href={`tel:${member.phoneNumber}`}
                                    >
                                        {member.phoneNumber}
                                    </a>
                                ) : null}
                                <span className="text-muted-foreground col-start-3 row-span-2 row-start-1 text-xs">
                                    {(assignmentsByMember.get(member.id) ?? 0) +
                                        (shadowsByMember.get(member.id) ??
                                            0)}{" "}
                                    duties
                                </span>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </>
    );
}
