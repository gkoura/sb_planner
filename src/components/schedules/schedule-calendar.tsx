import { buildMonthWeeks } from "@/lib/month-calendar";

type ScheduleMember = {
  id: string;
  nameSnapshot: string;
  roleSnapshot: string;
};

type ScheduleAssignment = {
  date: string;
  planningMemberId: string;
  nameSnapshot: string;
  roleSnapshot: string;
};

const SCHEDULE_COLORS = [
  { background: "#DCEBFF", foreground: "#285A9F" },
  { background: "#DDF3E4", foreground: "#267044" },
  { background: "#FDE8D7", foreground: "#A64F16" },
  { background: "#F1E2FA", foreground: "#754092" },
  { background: "#FFE2E6", foreground: "#A33A50" },
  { background: "#FFF2C6", foreground: "#85620A" },
  { background: "#D9F1F1", foreground: "#236C70" },
  { background: "#E8E8EB", foreground: "#50515A" },
  { background: "#E5EDCF", foreground: "#5D7027" },
  { background: "#FCE1F3", foreground: "#923C73" },
  { background: "#DDE6F8", foreground: "#3F4E8A" },
  { background: "#F4E6D8", foreground: "#7D5634" },
];

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
}: {
  year: number;
  month: number;
  members: ScheduleMember[];
  assignments: ScheduleAssignment[];
}) {
  const weeks = buildMonthWeeks(year, month);
  const colorsByMemberId = new Map(
    members.map((member, index) => [member.id, SCHEDULE_COLORS[index % SCHEDULE_COLORS.length]]),
  );
  const assignmentsByDate = new Map(assignments.map((assignment) => [assignment.date, assignment]));
  const assignmentsByMember = new Map<string, number>();
  for (const assignment of assignments) {
    assignmentsByMember.set(
      assignment.planningMemberId,
      (assignmentsByMember.get(assignment.planningMemberId) ?? 0) + 1,
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-background p-1 sm:p-3">
        <table aria-label="Daily standby assignments" className="w-full table-fixed border-separate border-spacing-1 text-left">
          <thead>
            <tr>
              {WEEKDAYS.map((weekday) => (
                <th className="pb-2 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs" key={weekday} scope="col">
                  <span className="sm:hidden">{weekday.slice(0, 1)}</span>
                  <span className="hidden sm:inline">{weekday.slice(0, 3)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIndex) => (
              <tr key={weekIndex}>
                {week.map((cell, weekdayIndex) => {
                  if (!cell) return <td aria-hidden="true" className="p-0" key={`${weekIndex}-${weekdayIndex}`} />;
                  const assignment = assignmentsByDate.get(cell.date);
                  const color = assignment ? colorsByMemberId.get(assignment.planningMemberId) : undefined;
                  const initials = assignment?.nameSnapshot
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <td
                      aria-label={assignment ? `${formatDate(cell.date)}: ${assignment.nameSnapshot}${assignment.roleSnapshot === "ADMIN" ? ", admin" : ""}` : `${formatDate(cell.date)}: unassigned`}
                      className="align-top p-0"
                      key={cell.date}
                    >
                      <div
                        className="flex min-h-12 flex-col justify-between rounded-lg border p-1.5 sm:min-h-20 sm:p-2.5"
                        style={color ? { backgroundColor: color.background, borderColor: `${color.foreground}55` } : undefined}
                        title={assignment?.nameSnapshot}
                      >
                        <span className="text-[0.65rem] font-semibold sm:text-xs" style={{ color: color?.foreground ?? "var(--muted-foreground)" }}>{cell.day}</span>
                        {assignment ? (
                          <>
                            <span className="my-1 grid size-6 place-items-center self-center rounded-full text-[0.6rem] font-bold sm:hidden" style={{ backgroundColor: color?.foreground, color: color?.background }}>
                              {initials}
                            </span>
                            <span className="hidden truncate text-[0.7rem] font-semibold leading-tight sm:block" style={{ color: color?.foreground }}>
                              {assignment.nameSnapshot}
                            </span>
                          </>
                        ) : <span className="text-[0.6rem] text-muted-foreground">Open</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label="Engineer color legend" className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => {
          const color = colorsByMemberId.get(member.id);
          return (
            <li className="flex min-w-0 items-center gap-2 rounded-lg border bg-background px-3 py-2" key={member.id}>
              <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: color?.foreground }} />
              <span className="min-w-0 truncate text-sm font-medium">{member.nameSnapshot}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {assignmentsByMember.get(member.id) ?? 0} days
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
