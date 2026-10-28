"use client";

import { useActionState, useMemo, useState } from "react";

import {
  saveScheduleEdit,
  type EditScheduleState,
} from "@/app/actions/schedules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildMonthWeeks } from "@/lib/month-calendar";
import { SCHEDULE_COLORS } from "@/lib/schedule-colors";
import {
  getAvailableDates,
  validateScheduleEdit,
  type ScheduleEditAssignment,
  type ScheduleInputMember,
} from "@/lib/schedule-edits";

type EditorMember = ScheduleInputMember & {
  roleSnapshot: string;
};

type EditorAssignment = ScheduleEditAssignment & {
  nameSnapshot: string;
  roleSnapshot: string;
  shadows?: {
    id: string;
    shadowMemberId: string;
    kind: "TRAINING" | "MENTORING";
    nameSnapshot: string;
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
const initialState: EditScheduleState = {};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function toEditorAssignments(
  assignments: EditorAssignment[],
): EditorAssignment[] {
  return assignments.map((assignment) => ({ ...assignment }));
}

export function ScheduleEditor({
  scheduleRunId,
  year,
  month,
  isPublished,
  today,
  members,
  assignments: initialAssignments,
}: {
  scheduleRunId: string;
  year: number;
  month: number;
  isPublished: boolean;
  today: string;
  members: EditorMember[];
  assignments: EditorAssignment[];
}) {
  const [state, formAction, isPending] = useActionState(
    saveScheduleEdit,
    initialState,
  );
  const [assignments, setAssignments] = useState(() =>
    toEditorAssignments(initialAssignments),
  );
  const [mode, setMode] = useState<"assign" | "swap">("assign");
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [swapDates, setSwapDates] = useState<string[]>([]);
  const [allowPastChanges, setAllowPastChanges] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const weeks = useMemo(() => buildMonthWeeks(year, month), [month, year]);
  const availableDatesByMember = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.id,
          getAvailableDates(year, month, member),
        ]),
      ),
    [members, month, year],
  );
  const assignmentsByDate = useMemo(
    () =>
      new Map(assignments.map((assignment) => [assignment.date, assignment])),
    [assignments],
  );
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const colorsByMemberId = useMemo(
    () =>
      new Map(
        members.map((member, index) => [
          member.id,
          SCHEDULE_COLORS[index % SCHEDULE_COLORS.length],
        ]),
      ),
    [members],
  );
  const validation = useMemo(
    () => validateScheduleEdit(year, month, members, assignments),
    [assignments, members, month, year],
  );
  const primaryAssignmentsJson = JSON.stringify(
    assignments.map(({ date, planningMemberId }) => ({
      date,
      planningMemberId,
    })),
  );
  const initialPrimaryAssignmentsJson = JSON.stringify(
    initialAssignments.map(({ date, planningMemberId }) => ({
      date,
      planningMemberId,
    })),
  );
  const hasChanges = primaryAssignmentsJson !== initialPrimaryAssignmentsJson;
  const selectedAssignment = activeDate
    ? assignmentsByDate.get(activeDate)
    : undefined;
  const membersForDate = activeDate
    ? members.filter((member) => member.participationMode !== "TRAINEE")
    : [];
  const workloads = new Map(members.map((member) => [member.id, 0]));
  const shadowWorkloads = new Map(members.map((member) => [member.id, 0]));
  for (const assignment of assignments) {
    workloads.set(
      assignment.planningMemberId,
      (workloads.get(assignment.planningMemberId) ?? 0) + 1,
    );
  }
  for (const assignment of initialAssignments) {
    for (const shadow of assignment.shadows ?? []) {
      shadowWorkloads.set(
        shadow.shadowMemberId,
        (shadowWorkloads.get(shadow.shadowMemberId) ?? 0) + 1,
      );
    }
  }
  const lockedPastChange =
    isPublished &&
    !allowPastChanges &&
    assignments.some(
      (assignment) =>
        assignment.date < today &&
        initialAssignments.find((original) => original.date === assignment.date)
          ?.planningMemberId !== assignment.planningMemberId,
    );
  const canSave =
    hasChanges &&
    validation.ok &&
    !lockedPastChange &&
    (!(isPublished || validation.warnings.length > 0) ||
      revisionReason.trim().length > 0) &&
    revisionReason.trim().length <= 500 &&
    !isPending;
  const saveDisabledReason = isPending
    ? null
    : !hasChanges
      ? "Make a calendar assignment change before saving."
      : !validation.ok
        ? "Fix the schedule structure issues shown above before saving."
        : lockedPastChange
          ? "Enable past-date corrections to save changes to earlier dates."
          : (isPublished || validation.warnings.length > 0) &&
              !revisionReason.trim()
            ? "Add a reason for this published change or schedule exception."
            : null;

  function selectDay(date: string) {
    const isLocked = isPublished && date < today && !allowPastChanges;
    if (isLocked) return;
    setFeedback("");
    if (mode === "assign") {
      setActiveDate(date);
      return;
    }
    setSwapDates((current) => {
      if (current.length === 0 || current.length === 2) return [date];
      if (current[0] === date) return [];
      return [current[0], date];
    });
  }

  function applyAssignment(memberId: string) {
    if (!activeDate) return;
    const member = memberById.get(memberId);
    if (!member) return;
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.date === activeDate
          ? {
              ...assignment,
              planningMemberId: member.id,
              nameSnapshot: member.name,
              roleSnapshot: member.roleSnapshot,
            }
          : assignment,
      ),
    );
    setFeedback(
      `${formatDate(activeDate)} change staged. Save the revision when ready.`,
    );
  }

  function applySwap() {
    if (swapDates.length !== 2) return;
    const [firstDate, secondDate] = swapDates;
    const first = assignmentsByDate.get(firstDate);
    const second = assignmentsByDate.get(secondDate);
    if (!first || !second) return;
    const swapped = assignments.map((assignment) =>
      assignment.date === firstDate
        ? {
            ...assignment,
            planningMemberId: second.planningMemberId,
            nameSnapshot: second.nameSnapshot,
            roleSnapshot: second.roleSnapshot,
          }
        : assignment.date === secondDate
          ? {
              ...assignment,
              planningMemberId: first.planningMemberId,
              nameSnapshot: first.nameSnapshot,
              roleSnapshot: first.roleSnapshot,
            }
          : assignment,
    );
    const result = validateScheduleEdit(year, month, members, swapped);
    if (!result.ok) {
      setFeedback(result.errors.slice(0, 2).join(" "));
      return;
    }
    setAssignments(swapped);
    setSwapDates([]);
    setFeedback(
      `${formatDate(firstDate)} and ${formatDate(secondDate)} swapped in the preview.`,
    );
  }

  function resetChanges() {
    setAssignments(toEditorAssignments(initialAssignments));
    setSwapDates([]);
    setActiveDate(null);
    setFeedback("Unsaved changes were discarded.");
  }

  return (
    <form action={formAction} className="grid gap-5">
      <input name="scheduleRunId" type="hidden" value={scheduleRunId} />
      <input name="assignments" type="hidden" value={primaryAssignmentsJson} />
      <input
        name="allowPastChanges"
        type="hidden"
        value={String(allowPastChanges)}
      />

      <Card className="border-dashed shadow-none">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>
              {isPublished
                ? "Adjust the official schedule"
                : "Adjust this candidate"}
            </CardTitle>
            <CardDescription className="mt-1">
              Change one day at a time, or swap two days. Other dates stay where
              they are; shadow pairings are recalculated when you save.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setMode("assign");
                setSwapDates([]);
                setFeedback("");
              }}
              size="sm"
              type="button"
              variant={mode === "assign" ? "secondary" : "outline"}
            >
              Edit a day
            </Button>
            <Button
              onClick={() => {
                setMode("swap");
                setActiveDate(null);
                setSwapDates([]);
                setFeedback("");
              }}
              size="sm"
              type="button"
              variant={mode === "swap" ? "secondary" : "outline"}
            >
              Swap two days
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {isPublished ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
              <input
                checked={allowPastChanges}
                className="mt-0.5 size-4 accent-primary"
                onChange={(event) => setAllowPastChanges(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="font-medium">
                  Allow corrections to past dates
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Past days are read-only by default. Changes still create a new
                  version and require a reason.
                </span>
              </span>
            </label>
          ) : null}

          <div className="overflow-hidden rounded-xl border bg-background p-1 sm:p-3">
            <table
              aria-label="Editable daily standby assignments"
              className="w-full table-fixed border-separate border-spacing-1 text-left"
            >
              <thead>
                <tr>
                  {WEEKDAYS.map((weekday) => (
                    <th
                      className="pb-2 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
                      key={weekday}
                      scope="col"
                    >
                      <span className="sm:hidden">{weekday.slice(0, 1)}</span>
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
                      const assignment = assignmentsByDate.get(cell.date);
                      const isToday = cell.date === today;
                      const color = assignment
                        ? colorsByMemberId.get(assignment.planningMemberId)
                        : undefined;
                      const isSelected =
                        activeDate === cell.date ||
                        swapDates.includes(cell.date);
                      const isLocked =
                        isPublished && cell.date < today && !allowPastChanges;
                      const initials = assignment?.nameSnapshot
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase();

                      return (
                        <td className="align-top p-0" key={cell.date}>
                          <button
                            aria-current={isToday ? "date" : undefined}
                            aria-label={`${isToday ? "Today, " : ""}${formatDate(cell.date)}: ${assignment?.nameSnapshot ?? "unassigned"}${isLocked ? ", past date locked" : ", click to edit"}`}
                            aria-pressed={isSelected}
                            className={`relative flex min-h-12 w-full flex-col justify-between rounded-lg border p-1.5 text-left transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-65 sm:min-h-20 sm:p-2.5 ${isSelected || isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                            disabled={isLocked || isPending}
                            onClick={() => selectDay(cell.date)}
                            style={
                              color
                                ? {
                                    backgroundColor: color.background,
                                    borderColor: `${color.foreground}70`,
                                  }
                                : undefined
                            }
                            title={`${formatDate(cell.date)} · ${assignment?.nameSnapshot ?? "Unassigned"}${isToday ? " · Today" : ""}${isLocked ? " · past date locked" : " · click to edit"}`}
                            type="button"
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
                                <span className="rounded bg-primary px-1 py-0.5 text-[0.5rem] font-bold uppercase tracking-wide text-primary-foreground sm:text-[0.55rem]">
                                  Today
                                </span>
                              ) : null}
                            </span>
                            {assignment ? (
                              <>
                                <span
                                  className="my-1 grid size-6 place-items-center self-center rounded-full text-[0.6rem] font-bold sm:hidden"
                                  style={{
                                    backgroundColor: color?.foreground,
                                    color: color?.background,
                                  }}
                                >
                                  {initials}
                                </span>
                                <span
                                  className="hidden truncate text-[0.7rem] font-semibold leading-tight sm:block"
                                  style={{ color: color?.foreground }}
                                >
                                  {assignment.nameSnapshot}
                                </span>
                                {!hasChanges
                                  ? (assignment.shadows ?? []).map((shadow) => (
                                      <span
                                        className="hidden truncate text-[0.6rem] font-medium leading-tight sm:block"
                                        key={shadow.id}
                                      >
                                        {shadow.kind === "TRAINING"
                                          ? "Shadow"
                                          : "Mentor"}
                                        : {shadow.nameSnapshot}
                                      </span>
                                    ))
                                  : null}
                              </>
                            ) : (
                              <span className="text-[0.6rem] text-muted-foreground">
                                Open
                              </span>
                            )}
                            {isLocked ? (
                              <span className="hidden text-[0.55rem] text-muted-foreground sm:block">
                                Past
                              </span>
                            ) : null}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mode === "assign" ? (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)] sm:items-end">
              <div>
                <p className="text-sm font-semibold">
                  {activeDate ? formatDate(activeDate) : "Choose a day to edit"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedAssignment
                    ? `Currently assigned to ${selectedAssignment.nameSnapshot}.`
                    : "Choose one of the dates in the calendar."}
                </p>
              </div>
              <div className="grid gap-1.5">
                <label
                  className="text-xs font-medium"
                  htmlFor="schedule-member"
                >
                  Assign participant
                </label>
                <Select
                  disabled={!activeDate || isPending}
                  itemToStringLabel={(memberId) =>
                    memberById.get(memberId)?.name ?? memberId
                  }
                  onValueChange={(memberId) => {
                    if (memberId) applyAssignment(memberId);
                  }}
                  value={selectedAssignment?.planningMemberId ?? ""}
                >
                  <SelectTrigger className="w-full" id="schedule-member">
                    <SelectValue placeholder="Choose an engineer" />
                  </SelectTrigger>
                  <SelectContent>
                    {membersForDate.map((member) => {
                      const isAvailable = activeDate
                        ? availableDatesByMember.get(member.id)?.has(activeDate)
                        : true;
                      return (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                          {isAvailable ? "" : " · unavailable"}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-sm font-semibold">
                  Choose two dates to swap
                </p>
                <p
                  aria-live="polite"
                  className="mt-1 text-xs text-muted-foreground"
                >
                  {swapDates.length === 0
                    ? "Select the first day on the calendar."
                    : swapDates.length === 1
                      ? `${formatDate(swapDates[0])} selected. Choose a second day.`
                      : `${formatDate(swapDates[0])} ↔ ${formatDate(swapDates[1])}`}
                </p>
              </div>
              <Button
                disabled={swapDates.length !== 2 || isPending}
                onClick={applySwap}
                type="button"
                variant="outline"
              >
                Preview swap
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Primary fairness{" "}
              {validation.ok ? validation.fairnessScore : "Needs attention"}
            </Badge>
            {validation.ok && validation.warnings.length > 0 ? (
              <Badge variant="outline">
                {validation.warnings.length} exception
                {validation.warnings.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
            {isPublished ? (
              <Badge variant="outline">
                New edits publish as a new version
              </Badge>
            ) : (
              <Badge variant="outline">Candidate only · not published</Badge>
            )}
          </div>

          {hasChanges &&
          initialAssignments.some(
            (assignment) => assignment.shadows?.length,
          ) ? (
            <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Shadow pairings will be recalculated and checked against
              availability and consecutive-day rules when this revision is
              saved.
            </p>
          ) : null}

          <div aria-live="polite" className="grid gap-1" role="status">
            {feedback ? (
              <p className="text-sm text-muted-foreground">{feedback}</p>
            ) : null}
            {!validation.ok
              ? validation.errors.slice(0, 3).map((error) => (
                  <p className="text-sm text-destructive" key={error}>
                    {error}
                  </p>
                ))
              : null}
            {validation.ok
              ? validation.warnings.slice(0, 5).map((warning) => (
                  <p
                    className="text-sm text-amber-700 dark:text-amber-300"
                    key={warning}
                  >
                    {warning}
                  </p>
                ))
              : null}
            {validation.ok ? (
              <ul
                aria-label="Updated participant workloads"
                className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
              >
                {members.map((member) => (
                  <li
                    className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2"
                    key={member.id}
                  >
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 rounded-sm"
                      style={{
                        backgroundColor: colorsByMemberId.get(member.id)
                          ?.foreground,
                      }}
                    />
                    <span className="min-w-0 truncate text-sm font-medium">
                      {member.name}
                    </span>
                    <span className="ml-auto shrink-0 text-right text-xs text-muted-foreground">
                      {workloads.get(member.id) ?? 0} primary
                      {hasChanges ? (
                        <span className="block">
                          shadow count updates on save
                        </span>
                      ) : (shadowWorkloads.get(member.id) ?? 0) > 0 ? (
                        <span className="block">
                          {shadowWorkloads.get(member.id)} shadow
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="revision-reason">
              Change reason{" "}
              {isPublished ||
              (validation.ok && validation.warnings.length > 0) ? (
                <span className="text-destructive">
                  (required for this change)
                </span>
              ) : (
                <span className="text-muted-foreground">(optional)</span>
              )}
            </label>
            <Textarea
              id="revision-reason"
              maxLength={500}
              name="revisionReason"
              onChange={(event) => setRevisionReason(event.target.value)}
              placeholder={
                isPublished || (validation.ok && validation.warnings.length > 0)
                  ? "Explain why this exception is needed."
                  : "Add context for this candidate adjustment."
              }
              required={
                isPublished || (validation.ok && validation.warnings.length > 0)
              }
              rows={2}
              value={revisionReason}
            />
            <p className="text-xs text-muted-foreground">
              {revisionReason.length}/500
            </p>
          </div>

          <div aria-atomic="true" aria-live="polite">
            {state.error ? (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}
            {state.success ? (
              <p
                className="text-sm text-emerald-700 dark:text-emerald-400"
                role="status"
              >
                {state.success}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={!canSave} type="submit">
              {isPending
                ? "Saving revision…"
                : isPublished
                  ? "Save and publish revision"
                  : "Save candidate revision"}
            </Button>
            <Button
              disabled={!hasChanges || isPending}
              onClick={resetChanges}
              type="button"
              variant="outline"
            >
              Discard unsaved edits
            </Button>
          </div>
          {saveDisabledReason ? (
            <p className="text-xs text-muted-foreground" role="status">
              {saveDisabledReason}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </form>
  );
}
