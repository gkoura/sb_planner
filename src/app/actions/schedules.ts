"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-guard";
import {
  generateSchedule,
  SCHEDULER_ALGORITHM_VERSION,
} from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";

export type GenerateScheduleState = {
  error?: string;
  success?: string;
};

export type PublishScheduleState = {
  error?: string;
  success?: string;
};

export async function publishScheduleRun(
  _previousState: PublishScheduleState,
  formData: FormData,
): Promise<PublishScheduleState> {
  await requireAdmin();
  const scheduleRunId = formData.get("scheduleRunId");
  if (typeof scheduleRunId !== "string" || scheduleRunId.length === 0) {
    return { error: "Choose a valid candidate schedule." };
  }

  const result = await prisma.$transaction(async (transaction) => {
    const run = await transaction.scheduleRun.findUnique({
      where: { id: scheduleRunId },
      include: { planningMonth: true, _count: { select: { assignments: true } } },
    });

    if (!run) return { error: "Candidate schedule not found." };
    if (!["GENERATED", "PUBLISHED"].includes(run.planningMonth.status)) {
      return { error: "Only a generated candidate can be published." };
    }
    const expectedDays = new Date(run.planningMonth.year, run.planningMonth.month, 0).getDate();
    if (run._count.assignments !== expectedDays) {
      return { error: "This candidate does not contain an assignment for every day." };
    }

    await transaction.scheduleRun.updateMany({
      where: { planningMonthId: run.planningMonthId },
      data: { publishedAt: null },
    });
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
  revalidatePath("/");
  return { success: "Schedule published. The team can now use it as the official plan." };
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

  const result = await prisma.$transaction(async (transaction) => {
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
      return { error: "Every participant must submit availability before generation." };
    }
    if (month.members.length === 0 || month.members.some((member) => !member.availabilitySubmission)) {
      return { error: "Every participant must submit availability before generation." };
    }

    const members = month.members.map((member) => ({
      id: member.id,
      name: member.nameSnapshot,
      mode: member.availabilitySubmission!.mode,
      dates: member.availabilitySubmission!.dates.map(({ date }) => date),
    }));
    const generated = generateSchedule(month.year, month.month, members);

    if (!generated.ok) return { error: generated.message };

    const latestRun = await transaction.scheduleRun.aggregate({
      where: { planningMonthId: month.id },
      _max: { version: true },
    });
    const version = (latestRun._max.version ?? 0) + 1;
    const memberById = new Map(month.members.map((member) => [member.id, member]));

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
            dates: member.availabilitySubmission!.dates.map(({ date }) => date),
          })),
          month: month.month,
          year: month.year,
        }),
        planningMonthId: month.id,
        version,
        assignments: {
          create: generated.assignments.map((assignment) => {
            const member = memberById.get(assignment.memberId);
            if (!member) throw new Error("A generated assignment has an unknown participant.");

            return {
              date: assignment.date,
              nameSnapshot: assignment.name,
              planningMemberId: member.id,
              roleSnapshot: member.roleSnapshot,
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
