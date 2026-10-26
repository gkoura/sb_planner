"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession, requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export type AvailabilityState = {
  error?: string;
  success?: string;
};

export async function openPlanningCollection(
  _previousState: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  await requireAdmin();
  const planningMonthId = formData.get("planningMonthId");

  if (typeof planningMonthId !== "string" || planningMonthId.length === 0) {
    return { error: "Choose a valid planning month." };
  }

  const month = await prisma.planningMonth.findUnique({
    where: { id: planningMonthId },
    select: { id: true, status: true },
  });

  if (!month || month.status !== "DRAFT") {
    return { error: "Only draft months can open availability collection." };
  }

  await prisma.planningMonth.update({
    where: { id: month.id },
    data: { status: "COLLECTING" },
  });

  revalidatePath("/admin/months");
  revalidatePath("/availability");
  return { success: "Availability collection is open." };
}

export async function submitAvailability(
  _previousState: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  const session = await getCurrentSession();
  if (!session) return { error: "Sign in to submit availability." };

  const planningMonthId = formData.get("planningMonthId");
  const mode = formData.get("mode");
  const rawDates = formData.getAll("dates");

  if (typeof planningMonthId !== "string" || planningMonthId.length === 0) {
    return { error: "Choose a valid planning month." };
  }

  if (mode !== "AVAILABLE" && mode !== "UNAVAILABLE") {
    return { error: "Choose whether your dates are available or unavailable." };
  }

  if (rawDates.some((date) => typeof date !== "string")) {
    return { error: "The selected dates are invalid." };
  }

  const dates = rawDates as string[];
  if (new Set(dates).size !== dates.length) {
    return { error: "A date was selected more than once." };
  }

  const month = await prisma.planningMonth.findFirst({
    where: {
      id: planningMonthId,
      members: { some: { userId: session.user.id } },
    },
    select: {
      id: true,
      month: true,
      status: true,
      year: true,
      members: { select: { id: true } },
    },
  });

  if (!month) return { error: "You are not a participant in this month." };
  if (month.status !== "COLLECTING" && month.status !== "READY") {
    return { error: "Availability collection is not open for this month." };
  }

  const daysInMonth = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  const datePattern = new RegExp(
    `^${month.year}-${String(month.month).padStart(2, "0")}-(\\d{2})$`,
  );
  if (
    dates.some((date) => {
      const match = datePattern.exec(date);
      return !match || Number(match[1]) < 1 || Number(match[1]) > daysInMonth;
    })
  ) {
    return { error: "Select dates within the planning month." };
  }

  const submissionResult = await prisma.$transaction(async (transaction) => {
    const currentMonth = await transaction.planningMonth.findUnique({
      where: { id: month.id },
      select: { status: true },
    });
    if (
      !currentMonth ||
      (currentMonth.status !== "COLLECTING" && currentMonth.status !== "READY")
    ) {
      return { error: "Availability collection has closed for this month." };
    }

    const member = await transaction.planningMember.findUnique({
      where: {
        planningMonthId_userId: {
          planningMonthId: month.id,
          userId: session.user.id,
        },
      },
      select: { id: true },
    });

    if (!member) throw new Error("Your planning membership could not be found.");

    await transaction.availabilitySubmission.upsert({
      where: { planningMemberId: member.id },
      create: {
        mode,
        planningMemberId: member.id,
        dates: { create: dates.map((date) => ({ date })) },
      },
      update: {
        mode,
        submittedAt: new Date(),
        dates: {
          deleteMany: {},
          create: dates.map((date) => ({ date })),
        },
      },
    });

    const submittedCount = await transaction.availabilitySubmission.count({
      where: { planningMember: { planningMonthId: month.id } },
    });
    const nextStatus = submittedCount === month.members.length ? "READY" : "COLLECTING";

    await transaction.planningMonth.update({
      where: { id: month.id },
      data: { status: nextStatus },
    });

    return { success: true };
  });

  if ("error" in submissionResult) return { error: submissionResult.error };

  revalidatePath("/availability");
  revalidatePath("/admin/months");
  revalidatePath("/");
  return {
    success:
      "Availability submitted. You can revise it until schedule generation begins.",
  };
}
