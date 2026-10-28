"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession, requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
    lockPlanningMonth,
    runMonthTransaction,
} from "@/lib/planning-month-lock";

export type AvailabilityState = {
    error?: string;
    success?: string;
};

type AvailabilitySource = "SELF" | "ADMIN";

type AvailabilityInput = {
    dates: string[];
    mode: "AVAILABLE" | "UNAVAILABLE";
    planningMonthId: string;
};

function readAvailabilityInput(formData: FormData): AvailabilityInput | null {
    const planningMonthId = formData.get("planningMonthId");
    const mode = formData.get("mode");
    const rawDates = formData.getAll("dates");

    if (typeof planningMonthId !== "string" || !planningMonthId) return null;
    if (mode !== "AVAILABLE" && mode !== "UNAVAILABLE") return null;
    if (rawDates.some((date) => typeof date !== "string")) return null;

    const dates = rawDates as string[];
    if (new Set(dates).size !== dates.length) return null;
    return { dates, mode, planningMonthId };
}

function revalidateAvailabilityPaths(planningMonthId: string) {
    revalidatePath("/availability");
    revalidatePath("/admin/months");
    revalidatePath(`/admin/months/${planningMonthId}`);
    revalidatePath(`/admin/months/${planningMonthId}/availability`);
    revalidatePath("/");
}

async function saveAvailability({
    input,
    actorId,
    source,
    planningMemberId,
}: {
    input: AvailabilityInput;
    actorId: string;
    source: AvailabilitySource;
    planningMemberId: string;
}): Promise<AvailabilityState> {
    const result = await runMonthTransaction(async (transaction) => {
        await lockPlanningMonth(transaction, input.planningMonthId);
        const month = await transaction.planningMonth.findUnique({
            where: { id: input.planningMonthId },
            select: {
                id: true,
                month: true,
                status: true,
                year: true,
                members: { select: { id: true } },
                scheduleRuns: { select: { id: true }, take: 1 },
            },
        });
        if (!month || month.status === "DRAFT") {
            return {
                error: "Availability collection is not open for this month.",
            };
        }
        if (
            (month.status !== "COLLECTING" && month.status !== "READY") ||
            month.scheduleRuns.length
        ) {
            return {
                error: "Availability is locked after schedule generation.",
            };
        }

        const daysInMonth = new Date(
            Date.UTC(month.year, month.month, 0),
        ).getUTCDate();
        const datePattern = new RegExp(
            `^${month.year}-${String(month.month).padStart(2, "0")}-(\\d{2})$`,
        );
        if (
            input.dates.some((date) => {
                const match = datePattern.exec(date);
                return (
                    !match ||
                    Number(match[1]) < 1 ||
                    Number(match[1]) > daysInMonth
                );
            })
        ) {
            return { error: "Select dates within the planning month." };
        }

        const member = await transaction.planningMember.findFirst({
            where: { id: planningMemberId, planningMonthId: month.id },
            select: { id: true },
        });
        if (!member) return { error: "That participant is not in this month." };

        await transaction.availabilitySubmission.upsert({
            where: { planningMemberId: member.id },
            create: {
                dates: { create: input.dates.map((date) => ({ date })) },
                mode: input.mode,
                planningMemberId: member.id,
                source,
                updatedByUserId: actorId,
            },
            update: {
                dates: {
                    create: input.dates.map((date) => ({ date })),
                    deleteMany: {},
                },
                mode: input.mode,
                source,
                submittedAt: new Date(),
                updatedByUserId: actorId,
            },
        });

        const submittedCount = await transaction.availabilitySubmission.count({
            where: { planningMember: { planningMonthId: month.id } },
        });
        await transaction.planningMonth.update({
            where: { id: month.id },
            data: {
                status:
                    submittedCount === month.members.length
                        ? "READY"
                        : "COLLECTING",
            },
        });
        return { success: true };
    });

    if ("error" in result) return { error: result.error };
    revalidateAvailabilityPaths(input.planningMonthId);
    return {
        success:
            source === "ADMIN"
                ? "Availability saved on the participant’s behalf."
                : "Availability saved. You can revise it until schedule generation begins.",
    };
}

export async function openPlanningCollection(
    _previousState: AvailabilityState,
    formData: FormData,
): Promise<AvailabilityState> {
    await requireAdmin();
    const planningMonthId = formData.get("planningMonthId");

    if (typeof planningMonthId !== "string" || planningMonthId.length === 0) {
        return { error: "Choose a valid planning month." };
    }

    const result = await runMonthTransaction(async (transaction) => {
        await lockPlanningMonth(transaction, planningMonthId);
        const month = await transaction.planningMonth.findUnique({
            where: { id: planningMonthId },
            select: { id: true, status: true },
        });
        if (!month || month.status !== "DRAFT") {
            return {
                error: "Only draft months can open availability collection.",
            };
        }
        await transaction.planningMonth.update({
            where: { id: month.id },
            data: { status: "COLLECTING" },
        });
        return { id: month.id };
    });
    if ("error" in result) return { error: result.error };

    revalidateAvailabilityPaths(result.id);
    return { success: "Availability collection is open." };
}

export async function submitAvailability(
    _previousState: AvailabilityState,
    formData: FormData,
): Promise<AvailabilityState> {
    const session = await getCurrentSession();
    if (!session) return { error: "Sign in to submit availability." };

    const input = readAvailabilityInput(formData);
    if (!input) return { error: "The availability form is invalid." };

    const member = await prisma.planningMember.findUnique({
        where: {
            planningMonthId_userId: {
                planningMonthId: input.planningMonthId,
                userId: session.user.id,
            },
        },
        select: { id: true },
    });
    if (!member) return { error: "You are not a participant in this month." };

    return saveAvailability({
        actorId: session.user.id,
        input,
        planningMemberId: member.id,
        source: "SELF",
    });
}

export async function submitAvailabilityForMember(
    _previousState: AvailabilityState,
    formData: FormData,
): Promise<AvailabilityState> {
    const admin = await requireAdmin();
    const input = readAvailabilityInput(formData);
    const planningMemberId = String(
        formData.get("planningMemberId") ?? "",
    ).trim();
    if (!input || !planningMemberId) {
        return { error: "The availability form is invalid." };
    }

    return saveAvailability({
        actorId: admin.user.id,
        input,
        planningMemberId,
        source: "ADMIN",
    });
}

export async function clearAvailabilityForMember(
    _previousState: AvailabilityState,
    formData: FormData,
): Promise<AvailabilityState> {
    await requireAdmin();
    const planningMonthId = String(
        formData.get("planningMonthId") ?? "",
    ).trim();
    const planningMemberId = String(
        formData.get("planningMemberId") ?? "",
    ).trim();
    if (!planningMonthId || !planningMemberId) {
        return { error: "Choose a valid participant." };
    }

    const result = await runMonthTransaction(async (transaction) => {
        await lockPlanningMonth(transaction, planningMonthId);
        const month = await transaction.planningMonth.findUnique({
            where: { id: planningMonthId },
            select: {
                id: true,
                status: true,
                scheduleRuns: { select: { id: true }, take: 1 },
            },
        });
        if (!month) return { error: "Planning month not found." };
        if (
            (month.status !== "COLLECTING" && month.status !== "READY") ||
            month.scheduleRuns.length
        ) {
            return {
                error: "Availability is locked after schedule generation.",
            };
        }

        const member = await transaction.planningMember.findFirst({
            where: { id: planningMemberId, planningMonthId: month.id },
            select: { id: true },
        });
        if (!member) return { error: "That participant is not in this month." };

        await transaction.availabilitySubmission.deleteMany({
            where: { planningMemberId: member.id },
        });
        await transaction.planningMonth.update({
            where: { id: month.id },
            data: { status: "COLLECTING" },
        });
        return { success: true };
    });

    if ("error" in result) return { error: result.error };
    revalidateAvailabilityPaths(planningMonthId);
    return {
        success:
            "Availability cleared. This participant now needs a submission.",
    };
}
