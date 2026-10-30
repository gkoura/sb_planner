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
import { ScheduleCalendar } from "@/components/schedules/schedule-calendar";
import { SCHEDULE_COLORS } from "@/lib/schedule-colors";
import {
    getAvailableDates,
    validateScheduleEdit,
    validateScheduleShadows,
    scheduleShadowSignature,
    type ScheduleEditAssignment,
    type ScheduleInputMember,
} from "@/lib/schedule-edits";

type EditorMember = ScheduleInputMember & {
    roleSnapshot: string;
    phoneNumber?: string | null;
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
    return assignments.map((assignment) => ({
        ...assignment,
        shadows: assignment.shadows?.map((shadow) => ({ ...shadow })) ?? [],
    }));
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
    const [isRecalculating, setIsRecalculating] = useState(false);
    const isBusy = isPending || isRecalculating;
    const [mode, setMode] = useState<"assign" | "swap">("assign");
    const [activeDate, setActiveDate] = useState<string | null>(null);
    const [swapDates, setSwapDates] = useState<string[]>([]);
    const [allowPastChanges, setAllowPastChanges] = useState(false);
    const [revisionReason, setRevisionReason] = useState("");
    const [feedback, setFeedback] = useState("");
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
            new Map(
                assignments.map((assignment) => [assignment.date, assignment]),
            ),
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
    const shadows = assignments.flatMap((assignment) =>
        (assignment.shadows ?? []).map((shadow) => ({
            date: assignment.date,
            shadowMemberId: shadow.shadowMemberId,
            kind: shadow.kind,
        })),
    );
    const shadowErrors = validateScheduleShadows(
        year,
        month,
        members,
        assignments,
        shadows,
    );
    const shadowsJson = JSON.stringify(shadows);
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
    const hasChanges =
        primaryAssignmentsJson !== initialPrimaryAssignmentsJson ||
        assignments.some(
            (assignment) =>
                scheduleShadowSignature(assignment.shadows ?? []) !==
                scheduleShadowSignature(
                    initialAssignments.find(
                        (original) => original.date === assignment.date,
                    )?.shadows ?? [],
                ),
        );
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
    for (const assignment of assignments) {
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
                (assignment.date < today &&
                    initialAssignments.find(
                        (original) => original.date === assignment.date,
                    )?.planningMemberId !== assignment.planningMemberId) ||
                (assignment.date < today &&
                    scheduleShadowSignature(assignment.shadows ?? []) !==
                        scheduleShadowSignature(
                            initialAssignments.find(
                                (original) => original.date === assignment.date,
                            )?.shadows ?? [],
                        )),
        );
    const canSave =
        hasChanges &&
        validation.ok &&
        shadowErrors.length === 0 &&
        !lockedPastChange &&
        (!(isPublished || validation.warnings.length > 0) ||
            revisionReason.trim().length > 0) &&
        revisionReason.trim().length <= 500 &&
        !isBusy;
    const saveDisabledReason = isBusy
        ? null
        : !hasChanges
          ? "Make a calendar assignment change before saving."
          : !validation.ok || shadowErrors.length > 0
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
        if (
            !activeDate ||
            (isPublished && activeDate < today && !allowPastChanges)
        )
            return;
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

    function applyShadow(memberId: string) {
        if (
            !activeDate ||
            !selectedAssignment ||
            (isPublished && activeDate < today && !allowPastChanges)
        )
            return;
        const member = memberById.get(memberId);
        const primary = memberById.get(selectedAssignment.planningMemberId);
        setAssignments((current) =>
            current.map((assignment) =>
                assignment.date === activeDate
                    ? {
                          ...assignment,
                          shadows: member
                              ? [
                                    {
                                        id: `${activeDate}:${member.id}`,
                                        shadowMemberId: member.id,
                                        nameSnapshot: member.name,
                                        kind:
                                            primary?.participationMode ===
                                            "MENTORED"
                                                ? "MENTORING"
                                                : "TRAINING",
                                    },
                                ]
                              : [],
                      }
                    : assignment,
            ),
        );
        setFeedback("Shadow change staged. Save the revision when ready.");
    }

    async function regenerateShadows() {
        // Load the bounded solver only when automatic placement is requested.
        setIsRecalculating(true);
        try {
            const { generateShadowsForAssignments } =
                await import("@/lib/scheduler");
            const result = generateShadowsForAssignments(
                year,
                month,
                members,
                assignments,
            );
            if (!result.ok) {
                setFeedback(result.message);
                return;
            }
            const next = assignments.map((assignment) => ({
                ...assignment,
                shadows: result.shadows
                    .filter((shadow) => shadow.date === assignment.date)
                    .map((shadow) => ({
                        id: `${shadow.date}:${shadow.shadowMemberId}`,
                        shadowMemberId: shadow.shadowMemberId,
                        nameSnapshot: shadow.name,
                        kind: shadow.kind,
                    })),
            }));
            if (
                isPublished &&
                !allowPastChanges &&
                next.some(
                    (assignment) =>
                        assignment.date < today &&
                        scheduleShadowSignature(assignment.shadows) !==
                            scheduleShadowSignature(
                                initialAssignments.find(
                                    (original) =>
                                        original.date === assignment.date,
                                )?.shadows ?? [],
                            ),
                )
            ) {
                setFeedback(
                    "Automatic placement would change past shadow pairings. Enable past-date corrections or edit future shadows manually.",
                );
                return;
            }
            setAssignments(next);
            setFeedback(
                "Shadow pairings recalculated in the preview. Save the revision when ready.",
            );
        } catch {
            setFeedback("Unable to recalculate shadows. Try again.");
        } finally {
            setIsRecalculating(false);
        }
    }

    function applySwap() {
        if (
            swapDates.length !== 2 ||
            (isPublished &&
                !allowPastChanges &&
                swapDates.some((date) => date < today))
        )
            return;
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
            <input name="shadows" type="hidden" value={shadowsJson} />
            <input name="scheduleRunId" type="hidden" value={scheduleRunId} />
            <input
                name="assignments"
                type="hidden"
                value={primaryAssignmentsJson}
            />
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
                            Change one day at a time, or swap two days. Other
                            Edit primary and shadow participants for each date.
                            Pairings stay as shown until you edit them or choose
                            Recalculate shadows.
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
                            variant={
                                mode === "assign" ? "secondary" : "outline"
                            }
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
                                className="accent-primary mt-0.5 size-4"
                                onChange={(event) =>
                                    setAllowPastChanges(event.target.checked)
                                }
                                type="checkbox"
                            />
                            <span>
                                <span className="font-medium">
                                    Allow corrections to past dates
                                </span>
                                <span className="text-muted-foreground mt-0.5 block text-xs">
                                    Past days are read-only by default. Changes
                                    still create a new version and require a
                                    reason.
                                </span>
                            </span>
                        </label>
                    ) : null}

                    <ScheduleCalendar
                        year={year}
                        month={month}
                        today={today}
                        members={members.map((member) => ({
                            id: member.id,
                            nameSnapshot: member.name,
                            roleSnapshot: member.roleSnapshot,
                            phoneNumber: member.phoneNumber,
                        }))}
                        assignments={assignments}
                        onSelectDate={selectDay}
                        selectedDates={activeDate ? [activeDate] : swapDates}
                        isDateLocked={(date) =>
                            isPublished && date < today && !allowPastChanges
                        }
                        disabled={isBusy}
                        showLegend={false}
                    />

                    {mode === "assign" ? (
                        <div className="bg-muted/20 grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)] sm:items-end">
                            <div>
                                <p className="text-sm font-semibold">
                                    {activeDate
                                        ? formatDate(activeDate)
                                        : "Choose a day to edit"}
                                </p>
                                <p className="text-muted-foreground mt-1 text-xs">
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
                                    disabled={
                                        !activeDate ||
                                        isBusy ||
                                        (isPublished &&
                                            activeDate < today &&
                                            !allowPastChanges)
                                    }
                                    itemToStringLabel={(memberId) =>
                                        memberById.get(memberId)?.name ??
                                        memberId
                                    }
                                    onValueChange={(memberId) => {
                                        if (memberId) applyAssignment(memberId);
                                    }}
                                    value={
                                        selectedAssignment?.planningMemberId ??
                                        ""
                                    }
                                >
                                    <SelectTrigger
                                        className="w-full"
                                        id="schedule-member"
                                    >
                                        <SelectValue placeholder="Choose an engineer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {membersForDate.map((member) => {
                                            const isAvailable =
                                                activeDate &&
                                                member.availabilitySubmitted !==
                                                    false
                                                    ? availableDatesByMember
                                                          .get(member.id)
                                                          ?.has(activeDate)
                                                    : true;
                                            return (
                                                <SelectItem
                                                    key={member.id}
                                                    value={member.id}
                                                >
                                                    {member.name}
                                                    {isAvailable
                                                        ? ""
                                                        : " · unavailable"}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5 sm:col-start-2">
                                <label
                                    className="text-xs font-medium"
                                    htmlFor="schedule-shadow"
                                >
                                    {memberById.get(
                                        selectedAssignment?.planningMemberId ??
                                            "",
                                    )?.participationMode === "MENTORED"
                                        ? "Mentor"
                                        : "Training shadow"}
                                </label>
                                <Select
                                    disabled={
                                        !activeDate ||
                                        isBusy ||
                                        (isPublished &&
                                            activeDate < today &&
                                            !allowPastChanges)
                                    }
                                    value={
                                        selectedAssignment?.shadows?.[0]
                                            ?.shadowMemberId ?? "none"
                                    }
                                    itemToStringLabel={(id) =>
                                        id === "none"
                                            ? "No shadow"
                                            : (memberById.get(id)?.name ?? id)
                                    }
                                    onValueChange={(id) => {
                                        if (id) applyShadow(id);
                                    }}
                                >
                                    <SelectTrigger
                                        id="schedule-shadow"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            No shadow
                                        </SelectItem>
                                        {members
                                            .filter(
                                                (member) =>
                                                    member.id !==
                                                        selectedAssignment?.planningMemberId &&
                                                    (memberById.get(
                                                        selectedAssignment?.planningMemberId ??
                                                            "",
                                                    )?.participationMode ===
                                                    "MENTORED"
                                                        ? member.participationMode !==
                                                          "TRAINEE"
                                                        : member.participationMode ===
                                                          "TRAINEE"),
                                            )
                                            .map((member) => (
                                                <SelectItem
                                                    key={member.id}
                                                    value={member.id}
                                                >
                                                    {member.name}
                                                    {activeDate &&
                                                    member.availabilitySubmitted !==
                                                        false &&
                                                    !availableDatesByMember
                                                        .get(member.id)
                                                        ?.has(activeDate)
                                                        ? " · unavailable"
                                                        : ""}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-muted-foreground text-xs">
                                    To move a trainee day, remove the shadow
                                    here and add it on the new date. All
                                    required shadow days must be assigned before
                                    saving.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-muted/20 grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                            <div>
                                <p className="text-sm font-semibold">
                                    Choose two dates to swap
                                </p>
                                <p
                                    aria-live="polite"
                                    className="text-muted-foreground mt-1 text-xs"
                                >
                                    {swapDates.length === 0
                                        ? "Select the first day on the calendar."
                                        : swapDates.length === 1
                                          ? `${formatDate(swapDates[0])} selected. Choose a second day.`
                                          : `${formatDate(swapDates[0])} ↔ ${formatDate(swapDates[1])}`}
                                </p>
                            </div>
                            <Button
                                disabled={swapDates.length !== 2 || isBusy}
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
                            {validation.ok
                                ? validation.fairnessScore
                                : "Needs attention"}
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
                            <Badge variant="outline">
                                Candidate only · not published
                            </Badge>
                        )}
                    </div>

                    {members.some(
                        (member) =>
                            member.participationMode === "TRAINEE" ||
                            member.participationMode === "MENTORED",
                    ) ? (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isBusy}
                            onClick={regenerateShadows}
                        >
                            {isRecalculating
                                ? "Recalculating shadows…"
                                : "Recalculate shadows"}
                        </Button>
                    ) : null}

                    <div
                        aria-live="polite"
                        className="grid gap-1"
                        role="status"
                    >
                        {feedback ? (
                            <p className="text-muted-foreground text-sm">
                                {feedback}
                            </p>
                        ) : null}
                        {shadowErrors.slice(0, 5).map((error) => (
                            <p className="text-destructive text-sm" key={error}>
                                {error}
                            </p>
                        ))}
                        {!validation.ok
                            ? validation.errors.slice(0, 3).map((error) => (
                                  <p
                                      className="text-destructive text-sm"
                                      key={error}
                                  >
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
                                        className="bg-background flex items-center gap-2 rounded-lg border px-3 py-2"
                                        key={member.id}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="size-3 shrink-0 rounded-sm"
                                            style={{
                                                backgroundColor:
                                                    colorsByMemberId.get(
                                                        member.id,
                                                    )?.foreground,
                                            }}
                                        />
                                        <span className="min-w-0 truncate text-sm font-medium">
                                            {member.name}
                                        </span>
                                        <span className="text-muted-foreground ml-auto shrink-0 text-right text-xs">
                                            {workloads.get(member.id) ?? 0}{" "}
                                            primary
                                            <span className="block">
                                                {shadowWorkloads.get(
                                                    member.id,
                                                ) ?? 0}{" "}
                                                shadow ·{" "}
                                                {(workloads.get(member.id) ??
                                                    0) +
                                                    (shadowWorkloads.get(
                                                        member.id,
                                                    ) ?? 0)}{" "}
                                                duties
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <label
                            className="text-sm font-medium"
                            htmlFor="revision-reason"
                        >
                            Change reason{" "}
                            {isPublished ||
                            (validation.ok &&
                                validation.warnings.length > 0) ? (
                                <span className="text-destructive">
                                    (required for this change)
                                </span>
                            ) : (
                                <span className="text-muted-foreground">
                                    (optional)
                                </span>
                            )}
                        </label>
                        <Textarea
                            id="revision-reason"
                            maxLength={500}
                            name="revisionReason"
                            onChange={(event) =>
                                setRevisionReason(event.target.value)
                            }
                            placeholder={
                                isPublished ||
                                (validation.ok &&
                                    validation.warnings.length > 0)
                                    ? "Explain why this exception is needed."
                                    : "Add context for this candidate adjustment."
                            }
                            required={
                                isPublished ||
                                (validation.ok &&
                                    validation.warnings.length > 0)
                            }
                            rows={2}
                            value={revisionReason}
                        />
                        <p className="text-muted-foreground text-xs">
                            {revisionReason.length}/500
                        </p>
                    </div>

                    <div aria-atomic="true" aria-live="polite">
                        {state.error ? (
                            <p
                                className="text-destructive text-sm"
                                role="alert"
                            >
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
                            disabled={!hasChanges || isBusy}
                            onClick={resetChanges}
                            type="button"
                            variant="outline"
                        >
                            Discard unsaved edits
                        </Button>
                    </div>
                    {saveDisabledReason ? (
                        <p
                            className="text-muted-foreground text-xs"
                            role="status"
                        >
                            {saveDisabledReason}
                        </p>
                    ) : null}
                </CardContent>
            </Card>
        </form>
    );
}
