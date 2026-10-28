"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-guard";
import {
    validateScheduleCsvImport,
    type ImportedScheduleAssignment,
    type ScheduleImportRosterMember,
} from "@/lib/schedule-import";
import { getOperationalDate } from "@/lib/schedule-edits";
import { prisma } from "@/lib/prisma";
import {
    lockPlanningMonth,
    runMonthTransaction,
} from "@/lib/planning-month-lock";

const CSV_IMPORT_VERSION = "csv-import-v1";

export type ScheduleImportPreview = {
    assignments: ImportedScheduleAssignment[];
    warnings: string[];
    fairnessScore: number;
    workloads: { assignedDays: number; memberId: string; name: string }[];
    isPublished: boolean;
    hasPastChanges: boolean;
    hasChanges: boolean;
    currentVersion: number | null;
    nextVersion: number;
    expectedCurrentRunId: string | null;
    expectedStatus: string;
};

export type ScheduleImportPreviewResult =
    { error: string; errors?: string[] } | { preview: ScheduleImportPreview };

export type ScheduleImportResult =
    | { error: string }
    | { success: true; planningMonthId: string; version: number };

export type ScheduleImportPayload = {
    planningMonthId: string;
    csvText: string;
    revisionReason: string;
    allowPastChanges: boolean;
    expectedCurrentRunId: string | null;
    expectedStatus: string;
};

function getRoster(month: {
    members: {
        id: string;
        nameSnapshot: string;
        emailSnapshot: string;
        roleSnapshot: string;
        participationMode: "NORMAL" | "TRAINEE" | "MENTORED";
        shadowDayCount: number;
        availabilitySubmission: {
            mode: "AVAILABLE" | "UNAVAILABLE";
            dates: { date: string }[];
        } | null;
    }[];
}): ScheduleImportRosterMember[] {
    return month.members.map((member) => ({
        id: member.id,
        nameSnapshot: member.nameSnapshot,
        emailSnapshot: member.emailSnapshot,
        roleSnapshot: member.roleSnapshot,
        participationMode: member.participationMode,
        shadowDayCount: member.shadowDayCount,
        availabilitySubmission: member.availabilitySubmission
            ? {
                  mode: member.availabilitySubmission.mode,
                  dates: member.availabilitySubmission.dates.map(
                      ({ date }) => date,
                  ),
              }
            : null,
    }));
}

function getCurrentRunChanges(
    currentRun: {
        assignments: {
            date: string;
            planningMemberId: string;
            shadows: { kind: string; shadowMemberId: string }[];
        }[];
    } | null,
    importedAssignments: ImportedScheduleAssignment[],
) {
    if (!currentRun) return { hasChanges: true, hasPastChanges: false };

    const currentByDate = new Map(
        currentRun.assignments.map((assignment) => [
            assignment.date,
            assignment,
        ]),
    );
    const operationalDate = getOperationalDate();
    let hasChanges = false;
    let hasPastChanges = false;

    for (const assignment of importedAssignments) {
        const current = currentByDate.get(assignment.date);
        const oldShadowSignature = (current?.shadows ?? [])
            .map((shadow) => `${shadow.kind}:${shadow.shadowMemberId}`)
            .sort()
            .join("|");
        const nextShadowSignature = assignment.shadows
            .map((shadow) => `${shadow.kind}:${shadow.shadowMemberId}`)
            .sort()
            .join("|");
        const changed =
            current?.planningMemberId !== assignment.planningMemberId ||
            oldShadowSignature !== nextShadowSignature;

        if (changed) {
            hasChanges = true;
            if (assignment.date < operationalDate) hasPastChanges = true;
        }
    }

    return { hasChanges, hasPastChanges };
}

async function loadImportMonth(planningMonthId: string) {
    return prisma.planningMonth.findUnique({
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
            scheduleRuns: {
                orderBy: { version: "desc" },
                take: 1,
                include: {
                    assignments: {
                        orderBy: { date: "asc" },
                        include: { shadows: true },
                    },
                },
            },
        },
    });
}

export async function previewScheduleCsvImport(
    planningMonthId: string,
    csvText: string,
): Promise<ScheduleImportPreviewResult> {
    await requireAdmin();
    if (!planningMonthId || typeof csvText !== "string") {
        return { error: "Choose a planning month and CSV file." };
    }

    const month = await loadImportMonth(planningMonthId);
    if (!month) return { error: "Planning month not found." };
    if (month.members.length === 0) {
        return {
            error: "Add participants to this month before importing a plan.",
        };
    }

    const validation = validateScheduleCsvImport(
        csvText,
        month.year,
        month.month,
        getRoster(month),
    );
    if (!validation.ok) {
        return {
            error: "Resolve the CSV issues before importing.",
            errors: validation.errors,
        };
    }

    const currentRun = month.scheduleRuns[0] ?? null;
    const changes = getCurrentRunChanges(currentRun, validation.assignments);
    if (currentRun && !changes.hasChanges) {
        return {
            error: "This CSV matches the current schedule. There is nothing to import.",
        };
    }

    return {
        preview: {
            assignments: validation.assignments,
            warnings: validation.warnings,
            fairnessScore: validation.fairnessScore,
            workloads: validation.workloads,
            isPublished: month.status === "PUBLISHED",
            hasPastChanges: changes.hasPastChanges,
            hasChanges: changes.hasChanges,
            currentVersion: currentRun?.version ?? null,
            nextVersion: (currentRun?.version ?? 0) + 1,
            expectedCurrentRunId: currentRun?.id ?? null,
            expectedStatus: month.status,
        },
    };
}

export async function importScheduleCsv(
    payload: ScheduleImportPayload,
): Promise<ScheduleImportResult> {
    const admin = await requireAdmin();
    if (
        !payload ||
        typeof payload.planningMonthId !== "string" ||
        typeof payload.csvText !== "string" ||
        typeof payload.revisionReason !== "string" ||
        typeof payload.allowPastChanges !== "boolean" ||
        (payload.expectedCurrentRunId !== null &&
            typeof payload.expectedCurrentRunId !== "string") ||
        typeof payload.expectedStatus !== "string"
    ) {
        return {
            error: "The import request is invalid. Preview the CSV again.",
        };
    }

    const reason = payload.revisionReason.trim();
    if (reason.length > 500) {
        return { error: "Import reasons must be 500 characters or fewer." };
    }

    try {
        const result = await runMonthTransaction(async (transaction) => {
            await lockPlanningMonth(transaction, payload.planningMonthId);
            const month = await transaction.planningMonth.findUnique({
                where: { id: payload.planningMonthId },
                include: {
                    members: {
                        orderBy: { nameSnapshot: "asc" },
                        include: {
                            availabilitySubmission: {
                                include: {
                                    dates: { orderBy: { date: "asc" } },
                                },
                            },
                        },
                    },
                    scheduleRuns: {
                        orderBy: { version: "desc" },
                        take: 1,
                        include: {
                            assignments: {
                                orderBy: { date: "asc" },
                                include: { shadows: true },
                            },
                        },
                    },
                },
            });

            if (!month) return { error: "Planning month not found." };
            if (month.status !== payload.expectedStatus) {
                return {
                    error: "The month changed after preview. Preview the CSV again.",
                };
            }

            const currentRun = month.scheduleRuns[0] ?? null;
            if ((currentRun?.id ?? null) !== payload.expectedCurrentRunId) {
                return {
                    error: "The schedule changed after preview. Preview the CSV again.",
                };
            }
            if (month.members.length === 0) {
                return { error: "This month has no participants to assign." };
            }

            const validation = validateScheduleCsvImport(
                payload.csvText,
                month.year,
                month.month,
                getRoster(month),
            );
            if (!validation.ok) {
                return {
                    error: validation.errors.slice(0, 5).join(" "),
                };
            }

            const changes = getCurrentRunChanges(
                currentRun,
                validation.assignments,
            );
            if (!changes.hasChanges) {
                return { error: "This CSV matches the current schedule." };
            }

            const isPublished = month.status === "PUBLISHED";
            if ((isPublished || validation.warnings.length > 0) && !reason) {
                return {
                    error: isPublished
                        ? "Add a reason before replacing the published schedule."
                        : "Add a reason to approve the schedule warnings.",
                };
            }
            if (
                isPublished &&
                changes.hasPastChanges &&
                !payload.allowPastChanges
            ) {
                return {
                    error: "This import changes published past dates. Enable past-date corrections to continue.",
                };
            }

            const latest = await transaction.scheduleRun.aggregate({
                where: { planningMonthId: month.id },
                _max: { version: true },
            });
            const version = (latest._max.version ?? 0) + 1;
            const memberById = new Map(
                month.members.map((member) => [member.id, member]),
            );

            const run = await transaction.scheduleRun.create({
                data: {
                    algorithmVersion: CSV_IMPORT_VERSION,
                    basedOnRunId: currentRun?.id ?? null,
                    createdBy: admin.user.id,
                    fairnessScore: validation.fairnessScore,
                    inputSnapshot: JSON.stringify({
                        source: "CSV_IMPORT",
                        members: validation.inputMembers,
                        month: month.month,
                        year: month.year,
                    }),
                    planningMonthId: month.id,
                    publishedAt: isPublished ? new Date() : null,
                    revisionReason: reason || null,
                    validationWarnings: validation.warnings.length
                        ? JSON.stringify(validation.warnings)
                        : null,
                    version,
                },
            });

            const assignmentRows = validation.assignments.map((assignment) => {
                const member = memberById.get(assignment.planningMemberId);
                if (!member) {
                    throw new Error(
                        "An imported participant is no longer in this month.",
                    );
                }
                return {
                    date: assignment.date,
                    nameSnapshot: member.nameSnapshot,
                    planningMemberId: member.id,
                    roleSnapshot: member.roleSnapshot,
                    scheduleRunId: run.id,
                };
            });
            await transaction.scheduleAssignment.createMany({
                data: assignmentRows,
            });

            const assignmentsByDate = new Map(
                (
                    await transaction.scheduleAssignment.findMany({
                        where: { scheduleRunId: run.id },
                        select: { id: true, date: true },
                    })
                ).map((assignment) => [assignment.date, assignment.id]),
            );
            const shadowRows = validation.assignments.flatMap((assignment) => {
                const scheduleAssignmentId = assignmentsByDate.get(
                    assignment.date,
                );
                if (!scheduleAssignmentId) {
                    throw new Error(
                        `The imported assignment for ${assignment.date} was not saved.`,
                    );
                }
                return assignment.shadows.map((shadow) => {
                    const shadowMember = memberById.get(shadow.shadowMemberId);
                    if (!shadowMember) {
                        throw new Error(
                            "An imported shadow participant is no longer in this month.",
                        );
                    }
                    return {
                        kind: shadow.kind,
                        nameSnapshot: shadowMember.nameSnapshot,
                        roleSnapshot: shadowMember.roleSnapshot,
                        scheduleAssignmentId,
                        shadowMemberId: shadowMember.id,
                    };
                });
            });
            if (shadowRows.length > 0) {
                await transaction.scheduleShadow.createMany({
                    data: shadowRows,
                });
            }

            await transaction.planningMonth.update({
                where: { id: month.id },
                data: { status: isPublished ? "PUBLISHED" : "GENERATED" },
            });

            return {
                success: true as const,
                planningMonthId: month.id,
                version: run.version,
            };
        });

        if ("error" in result) return result;
        revalidatePath("/admin/months");
        revalidatePath(`/admin/months/${result.planningMonthId}`);
        revalidatePath(`/admin/months/${result.planningMonthId}/import`);
        revalidatePath("/schedules");
        revalidatePath(`/schedules/${result.planningMonthId}`);
        revalidatePath("/");
        return result;
    } catch (error) {
        console.error("Unable to import schedule CSV.", error);
        return {
            error: "Unable to save the imported schedule. No changes were committed. Please try again.",
        };
    }
}
