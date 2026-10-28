"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-guard";
import {
    generateShadowsForAssignments,
    generateSchedule,
    SCHEDULER_ALGORITHM_VERSION,
} from "@/lib/scheduler";
import {
    getOperationalDate,
    parseScheduleInputSnapshot,
    validateScheduleEdit,
    type ScheduleEditAssignment,
} from "@/lib/schedule-edits";
import {
    lockPlanningMonth,
    runMonthTransaction,
} from "@/lib/planning-month-lock";

export type GenerateScheduleState = {
    error?: string;
    success?: string;
};

export type PublishScheduleState = {
    error?: string;
    success?: string;
};

export type EditScheduleState = {
    error?: string;
    success?: string;
};

export type RestoreScheduleState = {
    error?: string;
    success?: string;
};

export async function restoreScheduleRun(
    _previousState: RestoreScheduleState,
    formData: FormData,
): Promise<RestoreScheduleState> {
    const admin = await requireAdmin();
    const sourceRunId = formData.get("sourceRunId");
    const reasonValue = formData.get("revisionReason");
    const allowPastChanges = formData.get("allowPastChanges") === "true";
    const reason = typeof reasonValue === "string" ? reasonValue.trim() : "";

    if (typeof sourceRunId !== "string" || !sourceRunId) {
        return { error: "Choose a schedule version to restore." };
    }
    if (!reason)
        return { error: "Add a reason for restoring this schedule version." };
    if (reason.length > 500)
        return { error: "Change reasons must be 500 characters or fewer." };

    const result = await runMonthTransaction(async (transaction) => {
        const runReference = await transaction.scheduleRun.findUnique({
            where: { id: sourceRunId },
            select: { planningMonthId: true },
        });
        if (!runReference) return { error: "Schedule version not found." };
        await lockPlanningMonth(transaction, runReference.planningMonthId);
        const source = await transaction.scheduleRun.findUnique({
            where: { id: sourceRunId },
            include: {
                assignments: {
                    orderBy: { date: "asc" },
                    include: { shadows: true },
                },
            },
        });
        if (!source) return { error: "Schedule version not found." };

        const month = await transaction.planningMonth.findUnique({
            where: { id: source.planningMonthId },
            select: { id: true, month: true, status: true, year: true },
        });
        if (
            !month ||
            (month.status !== "GENERATED" && month.status !== "PUBLISHED")
        ) {
            return {
                error: "Only a generated or published schedule can be restored.",
            };
        }

        const current = await transaction.scheduleRun.findFirst({
            where: { planningMonthId: month.id },
            orderBy: { version: "desc" },
            include: {
                assignments: {
                    orderBy: { date: "asc" },
                    include: { shadows: true },
                },
            },
        });
        if (!current) return { error: "There is no current schedule version." };
        if (current.id === source.id)
            return { error: "This version is already current." };

        const latest = await transaction.scheduleRun.aggregate({
            where: { planningMonthId: month.id },
            _max: { version: true },
        });
        if (current.version !== latest._max.version) {
            return {
                error: "The schedule has changed. Refresh the page and try again.",
            };
        }

        const snapshot = parseScheduleInputSnapshot(source.inputSnapshot);
        if (
            !snapshot ||
            snapshot.year !== month.year ||
            snapshot.month !== month.month
        ) {
            return {
                error: "The original availability snapshot is invalid, so this version cannot be restored.",
            };
        }
        const assignments = source.assignments.map(
            ({ date, planningMemberId }) => ({ date, planningMemberId }),
        );
        const validation = validateScheduleEdit(
            month.year,
            month.month,
            snapshot.members,
            assignments,
        );
        if (!validation.ok)
            return { error: validation.errors.slice(0, 3).join(" ") };

        const currentByDate = new Map(
            current.assignments.map((assignment) => [
                assignment.date,
                assignment.planningMemberId,
            ]),
        );
        const sourceByDate = new Map(
            assignments.map((assignment) => [
                assignment.date,
                assignment.planningMemberId,
            ]),
        );
        const shadowSignature = (
            shadows: { kind: string; shadowMemberId: string }[],
        ) =>
            shadows
                .map((shadow) => `${shadow.kind}:${shadow.shadowMemberId}`)
                .sort()
                .join("|");
        const sourceShadowsByDate = new Map(
            source.assignments.map((assignment) => [
                assignment.date,
                shadowSignature(assignment.shadows),
            ]),
        );
        const currentShadowsByDate = new Map(
            current.assignments.map((assignment) => [
                assignment.date,
                shadowSignature(assignment.shadows),
            ]),
        );
        if (
            source.inputSnapshot === current.inputSnapshot &&
            source.algorithmVersion === current.algorithmVersion &&
            assignments.every(
                (assignment) =>
                    currentByDate.get(assignment.date) ===
                        assignment.planningMemberId &&
                    currentShadowsByDate.get(assignment.date) ===
                        sourceShadowsByDate.get(assignment.date),
            )
        ) {
            return {
                error: "This version already matches the current schedule.",
            };
        }

        const isPublished = month.status === "PUBLISHED";
        const operationalDate = getOperationalDate();
        if (
            isPublished &&
            !allowPastChanges &&
            assignments.some(
                (assignment) =>
                    assignment.date < operationalDate &&
                    currentByDate.get(assignment.date) !==
                        sourceByDate.get(assignment.date),
            )
        ) {
            return {
                error: "Restoring this version changes past dates. Enable past-date corrections to continue.",
            };
        }
        if (
            isPublished &&
            !allowPastChanges &&
            assignments.some(
                (assignment) =>
                    assignment.date < operationalDate &&
                    currentShadowsByDate.get(assignment.date) !==
                        sourceShadowsByDate.get(assignment.date),
            )
        ) {
            return {
                error: "Restoring this version changes past shadow pairings. Enable past-date corrections to continue.",
            };
        }

        const planningMembers = await transaction.planningMember.findMany({
            where: { planningMonthId: month.id },
            select: { id: true, nameSnapshot: true, roleSnapshot: true },
        });
        const memberById = new Map(
            planningMembers.map((member) => [member.id, member]),
        );
        if (
            assignments.some(
                (assignment) => !memberById.has(assignment.planningMemberId),
            )
        ) {
            return {
                error: "A participant from this version is no longer in the planning month.",
            };
        }

        const version = (latest._max.version ?? 0) + 1;
        const revision = await transaction.scheduleRun.create({
            data: {
                algorithmVersion: source.algorithmVersion,
                basedOnRunId: current.id,
                createdBy: admin.user.id,
                fairnessScore: validation.fairnessScore,
                inputSnapshot: source.inputSnapshot,
                planningMonthId: month.id,
                publishedAt: isPublished ? new Date() : null,
                revisionReason: reason,
                validationWarnings: validation.warnings.length
                    ? JSON.stringify(validation.warnings)
                    : null,
                version,
                assignments: {
                    create: source.assignments.map((assignment) => ({
                        date: assignment.date,
                        nameSnapshot: assignment.nameSnapshot,
                        planningMemberId: assignment.planningMemberId,
                        roleSnapshot: assignment.roleSnapshot,
                        shadows: {
                            create: assignment.shadows.map((shadow) => ({
                                kind: shadow.kind,
                                nameSnapshot: shadow.nameSnapshot,
                                roleSnapshot: shadow.roleSnapshot,
                                shadowMemberId: shadow.shadowMemberId,
                            })),
                        },
                    })),
                },
            },
        });

        return {
            planningMonthId: month.id,
            revisionId: revision.id,
            isPublished,
        };
    });

    if ("error" in result) return { error: result.error };
    revalidatePath(`/admin/months/${result.planningMonthId}`);
    revalidatePath("/schedules");
    revalidatePath(`/schedules/${result.planningMonthId}`);
    return {
        success: result.isPublished
            ? "The selected schedule was restored as a new published version."
            : "The selected schedule was restored as a new candidate version.",
    };
}

export async function saveScheduleEdit(
    _previousState: EditScheduleState,
    formData: FormData,
): Promise<EditScheduleState> {
    const admin = await requireAdmin();
    const scheduleRunId = formData.get("scheduleRunId");
    const assignmentsValue = formData.get("assignments");
    const revisionReasonValue = formData.get("revisionReason");
    const allowPastChanges = formData.get("allowPastChanges") === "true";

    if (typeof scheduleRunId !== "string" || scheduleRunId.length === 0) {
        return { error: "Choose a valid schedule version." };
    }
    if (typeof assignmentsValue !== "string") {
        return { error: "The edited assignments could not be read." };
    }

    let assignments: ScheduleEditAssignment[];
    try {
        const parsed: unknown = JSON.parse(assignmentsValue);
        if (
            !Array.isArray(parsed) ||
            parsed.some(
                (assignment) =>
                    !assignment ||
                    typeof assignment.date !== "string" ||
                    typeof assignment.planningMemberId !== "string",
            )
        )
            return { error: "The edited assignments are invalid." };
        assignments = parsed;
    } catch {
        return { error: "The edited assignments are invalid." };
    }

    const revisionReason =
        typeof revisionReasonValue === "string"
            ? revisionReasonValue.trim()
            : "";
    if (revisionReason.length > 500) {
        return { error: "Change reasons must be 500 characters or fewer." };
    }

    const result = await runMonthTransaction(async (transaction) => {
        const runReference = await transaction.scheduleRun.findUnique({
            where: { id: scheduleRunId },
            select: { planningMonthId: true },
        });
        if (!runReference) return { error: "Schedule version not found." };
        await lockPlanningMonth(transaction, runReference.planningMonthId);
        const run = await transaction.scheduleRun.findUnique({
            where: { id: scheduleRunId },
            include: {
                planningMonth: true,
                assignments: {
                    orderBy: { date: "asc" },
                    include: { shadows: true },
                },
            },
        });
        if (!run) return { error: "Schedule version not found." };

        const isPublished = run.planningMonth.status === "PUBLISHED";
        if (isPublished && !run.publishedAt) {
            return {
                error: "Only a previously published version can be edited.",
            };
        }
        if (
            run.planningMonth.status !== "PUBLISHED" &&
            run.planningMonth.status !== "GENERATED"
        ) {
            return {
                error: "Only a generated candidate or published schedule can be edited.",
            };
        }
        if (!isPublished && run.publishedAt) {
            return {
                error: "This candidate is no longer current. Refresh the page and try again.",
            };
        }

        const latest = await transaction.scheduleRun.aggregate({
            where: { planningMonthId: run.planningMonthId },
            _max: { version: true },
        });
        if (run.version !== latest._max.version) {
            return {
                error: "This schedule version is no longer current. Refresh the page and try again.",
            };
        }

        if (isPublished && !revisionReason) {
            return {
                error: "Add a short reason for publishing this schedule change.",
            };
        }

        const snapshot = parseScheduleInputSnapshot(run.inputSnapshot);
        if (
            !snapshot ||
            snapshot.year !== run.planningMonth.year ||
            snapshot.month !== run.planningMonth.month
        ) {
            return {
                error: "The original availability snapshot is invalid, so this schedule cannot be edited.",
            };
        }

        const validation = validateScheduleEdit(
            snapshot.year,
            snapshot.month,
            snapshot.members,
            assignments,
        );
        if (!validation.ok) {
            return { error: validation.errors.slice(0, 3).join(" ") };
        }
        if (validation.warnings.length > 0 && !revisionReason) {
            return {
                error: "Add a short reason to approve these schedule exceptions.",
            };
        }

        const oldAssignments = new Map(
            run.assignments.map((assignment) => [
                assignment.date,
                assignment.planningMemberId,
            ]),
        );
        if (
            assignments.every(
                (assignment) =>
                    oldAssignments.get(assignment.date) ===
                    assignment.planningMemberId,
            )
        ) {
            return {
                error: "Make at least one assignment change before saving.",
            };
        }

        const operationalDate = getOperationalDate();
        if (
            isPublished &&
            !allowPastChanges &&
            assignments.some(
                (assignment) =>
                    assignment.date < operationalDate &&
                    oldAssignments.get(assignment.date) !==
                        assignment.planningMemberId,
            )
        ) {
            return {
                error: "Past published dates are locked. Enable past-date corrections and provide a reason to change them.",
            };
        }

        const planningMembers = await transaction.planningMember.findMany({
            where: { planningMonthId: run.planningMonthId },
            select: { id: true, nameSnapshot: true, roleSnapshot: true },
        });
        const memberById = new Map(
            planningMembers.map((member) => [member.id, member]),
        );
        if (
            assignments.some(
                (assignment) => !memberById.has(assignment.planningMemberId),
            )
        ) {
            return {
                error: "A selected participant is no longer in this planning month.",
            };
        }

        const shadowPlan = generateShadowsForAssignments(
            snapshot.year,
            snapshot.month,
            snapshot.members,
            assignments,
        );
        if (!shadowPlan.ok) {
            return {
                error: `Could not place the required shadows: ${shadowPlan.message}`,
            };
        }
        if (isPublished && !allowPastChanges) {
            const shadowSignature = (
                shadows: { kind: string; shadowMemberId: string }[],
            ) =>
                shadows
                    .map((shadow) => `${shadow.kind}:${shadow.shadowMemberId}`)
                    .sort()
                    .join("|");
            const oldShadowsByDate = new Map(
                run.assignments.map((assignment) => [
                    assignment.date,
                    shadowSignature(assignment.shadows),
                ]),
            );
            const newShadowsByDate = new Map<string, string>();
            for (const shadow of shadowPlan.shadows) {
                newShadowsByDate.set(
                    shadow.date,
                    [
                        ...(newShadowsByDate.get(shadow.date)
                            ? [newShadowsByDate.get(shadow.date)!]
                            : []),
                        `${shadow.kind}:${shadow.shadowMemberId}`,
                    ]
                        .sort()
                        .join("|"),
                );
            }
            if (
                assignments.some(
                    (assignment) =>
                        assignment.date < operationalDate &&
                        oldShadowsByDate.get(assignment.date) !==
                            newShadowsByDate.get(assignment.date),
                )
            ) {
                return {
                    error: "This edit changes past shadow pairings. Enable past-date corrections to continue.",
                };
            }
        }

        const latestVersion = (latest._max.version ?? 0) + 1;
        const publishedAt = isPublished ? new Date() : null;
        const revision = await transaction.scheduleRun.create({
            data: {
                algorithmVersion: run.algorithmVersion,
                basedOnRunId: run.id,
                createdBy: admin.user.id,
                fairnessScore: validation.fairnessScore,
                inputSnapshot: run.inputSnapshot,
                planningMonthId: run.planningMonthId,
                publishedAt,
                revisionReason: revisionReason || null,
                validationWarnings:
                    validation.warnings.length > 0
                        ? JSON.stringify(validation.warnings)
                        : null,
                version: latestVersion,
                assignments: {
                    create: assignments.map((assignment) => {
                        const member = memberById.get(
                            assignment.planningMemberId,
                        )!;
                        return {
                            date: assignment.date,
                            nameSnapshot: member.nameSnapshot,
                            planningMemberId: member.id,
                            roleSnapshot: member.roleSnapshot,
                            shadows: {
                                create: shadowPlan.shadows
                                    .filter(
                                        (shadow) =>
                                            shadow.date === assignment.date,
                                    )
                                    .map((shadow) => {
                                        const shadowMember = memberById.get(
                                            shadow.shadowMemberId,
                                        )!;
                                        return {
                                            kind: shadow.kind,
                                            nameSnapshot: shadow.name,
                                            roleSnapshot:
                                                shadowMember.roleSnapshot,
                                            shadowMemberId: shadowMember.id,
                                        };
                                    }),
                            },
                        };
                    }),
                },
            },
        });

        return {
            planningMonthId: run.planningMonthId,
            revisionId: revision.id,
            isPublished,
        };
    });

    if ("error" in result) return { error: result.error };
    revalidatePath(`/admin/months/${result.planningMonthId}`);
    revalidatePath("/schedules");
    revalidatePath(`/schedules/${result.planningMonthId}`);
    return {
        success: result.isPublished
            ? "A new official schedule version has been published."
            : "Your candidate edits have been saved as a new version.",
    };
}

export async function publishScheduleRun(
    _previousState: PublishScheduleState,
    formData: FormData,
): Promise<PublishScheduleState> {
    await requireAdmin();
    const scheduleRunId = formData.get("scheduleRunId");
    if (typeof scheduleRunId !== "string" || scheduleRunId.length === 0) {
        return { error: "Choose a valid candidate schedule." };
    }

    const result = await runMonthTransaction(async (transaction) => {
        const runReference = await transaction.scheduleRun.findUnique({
            where: { id: scheduleRunId },
            select: { planningMonthId: true },
        });
        if (!runReference) return { error: "Schedule version not found." };
        await lockPlanningMonth(transaction, runReference.planningMonthId);
        const run = await transaction.scheduleRun.findUnique({
            where: { id: scheduleRunId },
            include: {
                planningMonth: true,
                _count: { select: { assignments: true } },
            },
        });

        if (!run) return { error: "Candidate schedule not found." };
        if (!["GENERATED", "PUBLISHED"].includes(run.planningMonth.status)) {
            return { error: "Only a generated candidate can be published." };
        }
        if (run.publishedAt) {
            return {
                error: "This schedule version has already been published.",
            };
        }
        const latestVersion = await transaction.scheduleRun.aggregate({
            where: { planningMonthId: run.planningMonthId },
            _max: { version: true },
        });
        if (run.version !== latestVersion._max.version) {
            return {
                error: "Only the latest schedule version can be published.",
            };
        }
        const expectedDays = new Date(
            run.planningMonth.year,
            run.planningMonth.month,
            0,
        ).getDate();
        if (run._count.assignments !== expectedDays) {
            return {
                error: "This candidate does not contain an assignment for every day.",
            };
        }

        await transaction.scheduleRun.update({
            where: { id: run.id },
            data: { publishedAt: new Date() },
        });
        await transaction.planningMonth.update({
            where: { id: run.planningMonthId },
            data: { status: "PUBLISHED" },
        });

        return { planningMonthId: run.planningMonthId };
    });

    if ("error" in result) return { error: result.error };
    revalidatePath("/admin/months");
    revalidatePath(`/admin/months/${result.planningMonthId}`);
    revalidatePath("/schedules");
    revalidatePath(`/schedules/${result.planningMonthId}`);
    revalidatePath("/");
    return {
        success:
            "Schedule published. The team can now use it as the official plan.",
    };
}

export async function createScheduleRun(
    _previousState: GenerateScheduleState,
    formData: FormData,
): Promise<GenerateScheduleState> {
    const admin = await requireAdmin();
    const planningMonthId = formData.get("planningMonthId");

    if (typeof planningMonthId !== "string" || planningMonthId.length === 0) {
        return { error: "Choose a valid planning month." };
    }

    const result = await runMonthTransaction(async (transaction) => {
        await lockPlanningMonth(transaction, planningMonthId);
        const month = await transaction.planningMonth.findUnique({
            where: { id: planningMonthId },
            include: {
                members: {
                    orderBy: { nameSnapshot: "asc" },
                    include: {
                        availabilitySubmission: {
                            include: { dates: { orderBy: { date: "asc" } } },
                        },
                    },
                },
            },
        });

        if (!month) return { error: "Planning month not found." };
        if (month.status !== "READY") {
            return {
                error: "Every participant must submit availability before generation.",
            };
        }
        if (
            month.members.length === 0 ||
            month.members.some((member) => !member.availabilitySubmission)
        ) {
            return {
                error: "Every participant must submit availability before generation.",
            };
        }

        const members = month.members.map((member) => ({
            id: member.id,
            name: member.nameSnapshot,
            mode: member.availabilitySubmission!.mode,
            dates: member.availabilitySubmission!.dates.map(({ date }) => date),
            participationMode: member.participationMode,
            shadowDayCount: member.shadowDayCount,
        }));
        const generated = generateSchedule(month.year, month.month, members);

        if (!generated.ok) return { error: generated.message };

        const latestRun = await transaction.scheduleRun.aggregate({
            where: { planningMonthId: month.id },
            _max: { version: true },
        });
        const version = (latestRun._max.version ?? 0) + 1;
        const memberById = new Map(
            month.members.map((member) => [member.id, member]),
        );

        const scheduleRun = await transaction.scheduleRun.create({
            data: {
                algorithmVersion: SCHEDULER_ALGORITHM_VERSION,
                createdBy: admin.user.id,
                fairnessScore: generated.fairnessScore,
                inputSnapshot: JSON.stringify({
                    members: month.members.map((member) => ({
                        id: member.id,
                        mode: member.availabilitySubmission!.mode,
                        name: member.nameSnapshot,
                        dates: member.availabilitySubmission!.dates.map(
                            ({ date }) => date,
                        ),
                        participationMode: member.participationMode,
                        shadowDayCount: member.shadowDayCount,
                    })),
                    month: month.month,
                    year: month.year,
                }),
                planningMonthId: month.id,
                version,
                assignments: {
                    create: generated.assignments.map((assignment) => {
                        const member = memberById.get(assignment.memberId);
                        if (!member)
                            throw new Error(
                                "A generated assignment has an unknown participant.",
                            );

                        return {
                            date: assignment.date,
                            nameSnapshot: assignment.name,
                            planningMemberId: member.id,
                            roleSnapshot: member.roleSnapshot,
                            shadows: {
                                create: generated.shadows
                                    .filter(
                                        (shadow) =>
                                            shadow.date === assignment.date,
                                    )
                                    .map((shadow) => {
                                        const shadowMember = memberById.get(
                                            shadow.shadowMemberId,
                                        );
                                        if (!shadowMember)
                                            throw new Error(
                                                "A generated shadow has an unknown participant.",
                                            );
                                        return {
                                            kind: shadow.kind,
                                            nameSnapshot: shadow.name,
                                            roleSnapshot:
                                                shadowMember.roleSnapshot,
                                            shadowMemberId: shadowMember.id,
                                        };
                                    }),
                            },
                        };
                    }),
                },
            },
        });

        await transaction.planningMonth.update({
            where: { id: month.id },
            data: { status: "GENERATED" },
        });

        return { scheduleRunId: scheduleRun.id };
    });

    revalidatePath("/admin/months");
    revalidatePath(`/admin/months/${planningMonthId}`);
    if ("error" in result) return { error: result.error };

    return { success: "Candidate schedule generated and saved for review." };
}
