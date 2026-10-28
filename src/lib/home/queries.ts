import { prisma } from "@/lib/prisma";

import type { HomeData, HomeUser } from "./types";

export async function getHomeData(
  user: HomeUser,
  today: string,
): Promise<HomeData> {
  const [publishedMonth, availabilityMonths, admin] = await Promise.all([
    getCurrentPublishedMonth(today),
    getAvailabilityOverview(user.id),
    user.role === "ADMIN" ? getAdminOverview() : Promise.resolve(null),
  ]);

  const currentRun = publishedMonth?.scheduleRuns[0];
  const todayAssignment = currentRun?.assignments.find(
    (assignment) => assignment.date === today,
  );
  const member = publishedMonth?.members.find(
    (candidate) => candidate.userId === user.id,
  );

  return {
    admin,
    availabilityMonths,
    personalSchedule:
      currentRun && publishedMonth
        ? {
            planningMonthId: publishedMonth.id,
            month: publishedMonth.month,
            year: publishedMonth.year,
            duties: currentRun.assignments.flatMap((assignment) => {
              if (assignment.planningMemberId === member?.id) {
                return [{ date: assignment.date, label: "Primary standby" }];
              }
              const shadow = assignment.shadows.find(
                (candidate) => candidate.shadowMemberId === member?.id,
              );
              if (!shadow) return [];
              return [
                {
                  date: assignment.date,
                  label:
                    shadow.kind === "TRAINING"
                      ? `Shadowing ${assignment.nameSnapshot}`
                      : `Mentoring ${assignment.nameSnapshot}`,
                },
              ];
            }),
          }
        : null,
    todayAssignment:
      todayAssignment && publishedMonth
        ? {
            name: todayAssignment.nameSnapshot,
            phoneNumber: todayAssignment.planningMember.user.phoneNumber,
            planningMonthId: publishedMonth.id,
          }
        : null,
  };
}

function getCurrentPublishedMonth(today: string) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));

  return prisma.planningMonth.findFirst({
    where: { year, month, status: "PUBLISHED" },
    include: {
      members: {
        orderBy: { nameSnapshot: "asc" },
        select: { id: true, userId: true },
      },
      scheduleRuns: {
        where: { publishedAt: { not: null } },
        orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
        take: 1,
        include: {
          assignments: {
            orderBy: { date: "asc" },
            include: {
              shadows: {
                select: { shadowMemberId: true, kind: true },
              },
              planningMember: {
                select: { user: { select: { phoneNumber: true } } },
              },
            },
          },
        },
      },
    },
  });
}

function getAvailabilityOverview(userId: string) {
  return prisma.planningMember
    .findMany({
      where: {
        userId,
        planningMonth: { status: { in: ["COLLECTING", "READY"] } },
      },
      select: {
        availabilitySubmission: { select: { id: true } },
        planningMonth: {
          select: { id: true, month: true, status: true, year: true },
        },
      },
      orderBy: [
        { planningMonth: { year: "asc" } },
        { planningMonth: { month: "asc" } },
      ],
    })
    .then((memberships) =>
      memberships.map((membership) => ({
        id: membership.planningMonth.id,
        month: membership.planningMonth.month,
        status: membership.planningMonth.status as "COLLECTING" | "READY",
        submitted: Boolean(membership.availabilitySubmission),
        year: membership.planningMonth.year,
      })),
    );
}

async function getAdminOverview() {
  const [recentMonths, engineerCount] = await Promise.all([
    prisma.planningMonth.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 3,
      include: {
        scheduleRuns: {
          orderBy: { version: "desc" },
          take: 1,
          select: { algorithmVersion: true },
        },
        members: {
          select: { availabilitySubmission: { select: { id: true } } },
        },
      },
    }),
    prisma.user.count({ where: { role: "ENGINEER" } }),
  ]);

  return {
    engineerCount,
    recentMonths: recentMonths.map((month) => ({
      id: month.id,
      imported: month.scheduleRuns[0]?.algorithmVersion === "csv-import-v1",
      memberCount: month.members.length,
      month: month.month,
      status: month.status,
      submissionCount: month.members.filter(
        (member) => member.availabilitySubmission,
      ).length,
      year: month.year,
    })),
  };
}
