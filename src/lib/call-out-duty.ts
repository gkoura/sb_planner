import { prisma } from "@/lib/prisma";
import { dutyDate } from "@/lib/call-outs";

type DutyEntry = {
    role: "PRIMARY" | "TRAINEE" | "MENTOR" | "SUPPORT" | "OVERTIME";
    startedAt: Date;
};

export async function validateCallOutDuties(
    userId: string,
    entries: DutyEntry[],
): Promise<string[]> {
    const checked = entries.map((entry) => ({
        ...entry,
        dutyDate: entry.role === "OVERTIME" ? null : dutyDate(entry.startedAt)!,
    }));
    const dates = [
        ...new Set(
            checked.flatMap((entry) =>
                entry.dutyDate ? [entry.dutyDate] : [],
            ),
        ),
    ];
    const monthKeys = [...new Set(dates.map((date) => date.slice(0, 7)))];
    const months = monthKeys.length
        ? await prisma.planningMonth.findMany({
              where: {
                  status: "PUBLISHED",
                  OR: monthKeys.map((key) => {
                      const [year, month] = key.split("-").map(Number);
                      return { year, month };
                  }),
              },
              select: {
                  scheduleRuns: {
                      where: { publishedAt: { not: null } },
                      orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
                      take: 1,
                      select: {
                          assignments: {
                              where: { date: { in: dates } },
                              select: {
                                  date: true,
                                  planningMember: { select: { userId: true } },
                                  shadows: {
                                      select: {
                                          kind: true,
                                          shadowMember: {
                                              select: { userId: true },
                                          },
                                      },
                                  },
                              },
                          },
                      },
                  },
              },
          })
        : [];
    const assignments = new Map(
        months.flatMap((month) =>
            (month.scheduleRuns[0]?.assignments ?? []).map(
                (assignment) => [assignment.date, assignment] as const,
            ),
        ),
    );
    return checked.flatMap((entry, index) => {
        if (entry.role === "OVERTIME") return [];
        const assignment = entry.dutyDate
            ? assignments.get(entry.dutyDate)
            : undefined;
        if (entry.role === "SUPPORT") {
            const hasDuty =
                assignment &&
                (assignment.planningMember.userId === userId ||
                    assignment.shadows.some(
                        (shadow) => shadow.shadowMember.userId === userId,
                    ));
            return hasDuty
                ? [
                      `Call-out ${index + 1}: you have a scheduled duty on ${entry.dutyDate}. Select your scheduled role instead of support.`,
                  ]
                : [];
        }
        if (!assignment)
            return [
                `Call-out ${index + 1}: no published duty exists for ${entry.dutyDate ?? "this date"}.`,
            ];
        const matches =
            entry.role === "PRIMARY"
                ? assignment.planningMember.userId === userId
                : assignment.shadows.some(
                      (shadow) =>
                          shadow.shadowMember.userId === userId &&
                          shadow.kind ===
                              (entry.role === "TRAINEE"
                                  ? "TRAINING"
                                  : "MENTORING"),
                  );
        return matches
            ? []
            : [
                  `Call-out ${index + 1}: you are not scheduled as ${entry.role.toLowerCase()} on ${entry.dutyDate}. Check the role and start time, or choose support when helping outside your assigned duty.`,
              ];
    });
}
