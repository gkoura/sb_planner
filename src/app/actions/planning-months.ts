"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const MAX_ENGINEERS = 10;

export type CreatePlanningMonthState = {
    error?: string;
    success?: string;
};

export type DeletePlanningMonthState = {
    error?: string;
};

export type ParticipationSettingsState = {
    error?: string;
    success?: string;
};

export async function saveParticipationSettings(
    _previousState: ParticipationSettingsState,
    formData: FormData,
): Promise<ParticipationSettingsState> {
    await requireAdmin();

    const planningMonthId = String(
        formData.get("planningMonthId") ?? "",
    ).trim();
    if (!planningMonthId) return { error: "Planning month is missing." };

    try {
        await prisma.$transaction(async (transaction) => {
            const month = await transaction.planningMonth.findUnique({
                where: { id: planningMonthId },
                include: {
                    members: {
                        select: {
                            id: true,
                            participationMode: true,
                            shadowDayCount: true,
                        },
                    },
                    scheduleRuns: { select: { id: true }, take: 1 },
                },
            });
            if (!month) throw new Error("Planning month not found.");
            if (!["DRAFT", "COLLECTING", "READY"].includes(month.status)) {
                throw new Error(
                    "Participation settings are locked after schedule generation.",
                );
            }
            if (month.scheduleRuns.length) {
                throw new Error(
                    "Participation settings are locked after schedule generation.",
                );
            }

            const daysInMonth = new Date(
                Date.UTC(month.year, month.month, 0),
            ).getUTCDate();
            const maxShadowDays = Math.ceil(daysInMonth / 2);
            const settings = month.members.map((member) => {
                const rawMode = formData.get(`mode:${member.id}`);
                const rawShadowDays = formData.get(`shadowDays:${member.id}`);
                if (
                    rawMode !== "NORMAL" &&
                    rawMode !== "TRAINEE" &&
                    rawMode !== "MENTORED"
                ) {
                    throw new Error(
                        "Choose a valid participation mode for every participant.",
                    );
                }
                const shadowDayCount =
                    rawMode === "TRAINEE" ? Number(rawShadowDays) : 0;
                if (
                    rawMode === "TRAINEE" &&
                    (!Number.isInteger(shadowDayCount) ||
                        shadowDayCount < 1 ||
                        shadowDayCount > maxShadowDays)
                ) {
                    throw new Error(
                        `Trainee shadow days must be between 1 and ${maxShadowDays} for this month.`,
                    );
                }
                return {
                    id: member.id,
                    participationMode: rawMode as
                        "NORMAL" | "TRAINEE" | "MENTORED",
                    shadowDayCount,
                };
            });

            const primaryMembers = settings.filter(
                (setting) => setting.participationMode !== "TRAINEE",
            );
            if (primaryMembers.length === 0) {
                throw new Error(
                    "At least one participant must have primary standby days.",
                );
            }
            if (
                settings.some(
                    (setting) =>
                        setting.participationMode === "MENTORED" &&
                        primaryMembers.filter(
                            (candidate) => candidate.id !== setting.id,
                        ).length === 0,
                )
            ) {
                throw new Error(
                    "Each mentored participant needs at least one other eligible mentor.",
                );
            }

            await Promise.all(
                settings.map((setting) =>
                    transaction.planningMember.update({
                        where: { id: setting.id },
                        data: {
                            participationMode: setting.participationMode,
                            shadowDayCount: setting.shadowDayCount,
                        },
                    }),
                ),
            );
        });
    } catch (error) {
        return {
            error:
                error instanceof Error
                    ? error.message
                    : "Unable to save participation settings.",
        };
    }

    revalidatePath(`/admin/months/${planningMonthId}`);
    revalidatePath("/");
    return { success: "Participation settings saved." };
}

export async function createPlanningMonth(
    _previousState: CreatePlanningMonthState,
    formData: FormData,
): Promise<CreatePlanningMonthState> {
    const adminSession = await requireAdmin();
    const rawMonth = formData.get("month");
    const includeAdmin = formData.get("includeAdmin") === "true";
    const rawMemberIds = formData.getAll("memberIds");

    if (typeof rawMonth !== "string") {
        return { error: "Choose a month to plan." };
    }

    const monthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(rawMonth);
    if (!monthMatch) {
        return { error: "Choose a valid month." };
    }

    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (year < 1) {
        return { error: "Choose a valid year." };
    }

    if (rawMemberIds.some((id) => typeof id !== "string")) {
        return { error: "The selected engineer list is invalid." };
    }

    const selectedIds = rawMemberIds as string[];
    const uniqueSelectedIds = [...new Set(selectedIds)];
    if (uniqueSelectedIds.length !== selectedIds.length) {
        return { error: "An engineer was selected more than once." };
    }

    if (selectedIds.length > MAX_ENGINEERS) {
        return { error: "A plan can include at most 10 engineer accounts." };
    }

    if (selectedIds.length === 0 && !includeAdmin) {
        return { error: "Select at least one participant for this month." };
    }

    try {
        await prisma.$transaction(async (transaction) => {
            const [existingMonth, engineerCount, selectedEngineers] =
                await Promise.all([
                    transaction.planningMonth.findUnique({
                        where: { year_month: { year, month } },
                        select: { id: true },
                    }),
                    transaction.user.count({ where: { role: "ENGINEER" } }),
                    uniqueSelectedIds.length > 0
                        ? transaction.user.findMany({
                              where: {
                                  id: { in: uniqueSelectedIds },
                                  role: "ENGINEER",
                              },
                              select: {
                                  email: true,
                                  id: true,
                                  name: true,
                                  role: true,
                              },
                          })
                        : Promise.resolve([]),
                ]);

            if (existingMonth) {
                throw new Error(
                    "A planning month already exists for that month.",
                );
            }

            if (engineerCount > MAX_ENGINEERS) {
                throw new Error("The team has more than 10 engineer accounts.");
            }

            if (selectedEngineers.length !== uniqueSelectedIds.length) {
                throw new Error("Choose only existing engineer accounts.");
            }

            const participants = selectedEngineers.map((engineer) => ({
                emailSnapshot: engineer.email,
                nameSnapshot: engineer.name,
                roleSnapshot: engineer.role,
                userId: engineer.id,
            }));

            if (includeAdmin) {
                participants.push({
                    emailSnapshot: adminSession.user.email,
                    nameSnapshot: adminSession.user.name,
                    roleSnapshot: "ADMIN",
                    userId: adminSession.user.id,
                });
            }

            await transaction.planningMonth.create({
                data: {
                    year,
                    month,
                    createdBy: adminSession.user.id,
                    members: { create: participants },
                },
            });
        });
    } catch (error) {
        return {
            error:
                error instanceof Error
                    ? error.message
                    : "Unable to create the planning month. Try again.",
        };
    }

    revalidatePath("/admin/months");
    revalidatePath("/");
    return { success: "Planning month created as a draft." };
}

export async function deleteDraftPlanningMonth(
    _previousState: DeletePlanningMonthState,
    formData: FormData,
): Promise<DeletePlanningMonthState> {
    await requireAdmin();

    const planningMonthId = String(
        formData.get("planningMonthId") ?? "",
    ).trim();
    if (!planningMonthId) {
        return { error: "Choose a planning month to delete." };
    }

    try {
        await prisma.$transaction(async (transaction) => {
            const planningMonth = await transaction.planningMonth.findUnique({
                where: { id: planningMonthId },
                select: {
                    scheduleRuns: { select: { id: true }, take: 1 },
                    status: true,
                },
            });

            if (!planningMonth) {
                throw new Error("This planning month no longer exists.");
            }

            if (
                planningMonth.status !== "DRAFT" ||
                planningMonth.scheduleRuns.length
            ) {
                throw new Error(
                    "Only draft months without schedule history can be deleted.",
                );
            }

            await transaction.planningMonth.delete({
                where: { id: planningMonthId },
            });
        });
    } catch (error) {
        return {
            error:
                error instanceof Error
                    ? error.message
                    : "Unable to delete this planning month. Try again.",
        };
    }

    revalidatePath("/admin/months");
    revalidatePath("/");
    return {};
}
