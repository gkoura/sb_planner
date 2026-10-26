export const SCHEDULER_ALGORITHM_VERSION = "v1";

const MAX_SEARCH_STATES = 250_000;
const MANDATORY_AVAILABILITY_LIMIT = 5;

export type SchedulerMemberInput = {
  id: string;
  name: string;
  mode: "AVAILABLE" | "UNAVAILABLE";
  dates: string[];
};

export type ScheduleAssignmentResult = {
  date: string;
  day: number;
  memberId: string;
  name: string;
};

export type ScheduleResult =
  | {
      ok: true;
      assignments: ScheduleAssignmentResult[];
      fairnessScore: number;
      visitedStates: number;
      workloads: { assignedDays: number; memberId: string; name: string }[];
    }
  | {
      ok: false;
      code: "INVALID_INPUT" | "INFEASIBLE" | "SEARCH_LIMIT";
      message: string;
      visitedStates: number;
    };

function daysInMonth(year: number, month: number) {
  if (month === 2) {
    const leapYear = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
    return leapYear ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateLabel(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

function failure(
  code: "INVALID_INPUT" | "INFEASIBLE" | "SEARCH_LIMIT",
  message: string,
  visitedStates = 0,
): ScheduleResult {
  return { ok: false, code, message, visitedStates };
}

export function generateSchedule(
  year: number,
  month: number,
  input: SchedulerMemberInput[],
): ScheduleResult {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    return failure("INVALID_INPUT", "Choose a valid planning year.");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return failure("INVALID_INPUT", "Choose a valid planning month.");
  }
  if (input.length === 0 || input.length > 11) {
    return failure("INVALID_INPUT", "A plan needs between 1 and 11 participants.");
  }

  const ids = new Set<string>();
  const names = new Set<string>();
  for (const member of input) {
    if (!member.id || !member.name.trim() || ids.has(member.id) || names.has(member.name)) {
      return failure("INVALID_INPUT", "Participant names and IDs must be unique and non-empty.");
    }
    if (member.mode !== "AVAILABLE" && member.mode !== "UNAVAILABLE") {
      return failure("INVALID_INPUT", `${member.name} has an invalid availability mode.`);
    }
    ids.add(member.id);
    names.add(member.name);
  }

  const days = daysInMonth(year, month);
  const allDays = Array.from({ length: days }, (_, index) => index + 1);
  let normalizedMembers: (SchedulerMemberInput & { availableDays: Set<number> })[];
  try {
    normalizedMembers = [...input]
      .sort((left, right) =>
        left.name < right.name
          ? -1
          : left.name > right.name
            ? 1
            : left.id < right.id
              ? -1
              : 1,
      )
      .map((member) => {
        const selected = new Set<number>();
        for (const date of member.dates) {
          const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
          if (
            !match ||
            Number(match[1]) !== year ||
            Number(match[2]) !== month ||
            Number(match[3]) < 1 ||
            Number(match[3]) > days ||
            selected.has(Number(match[3]))
          ) {
            throw new Error(`${member.name} has an invalid date in their availability.`);
          }
          selected.add(Number(match[3]));
        }

        return {
          ...member,
          availableDays: new Set(
            member.mode === "AVAILABLE"
              ? selected
              : allDays.filter((day) => !selected.has(day)),
          ),
        };
      });
  } catch (error) {
    return failure(
      "INVALID_INPUT",
      error instanceof Error ? error.message : "Availability input is invalid.",
    );
  }

  const availableMembersByDay = allDays.map((day) =>
    normalizedMembers.flatMap((member, memberIndex) =>
      member.availableDays.has(day) ? [memberIndex] : [],
    ),
  );

  for (let day = 1; day <= days; day += 1) {
    if (availableMembersByDay[day - 1].length === 0) {
      return failure(
        "INFEASIBLE",
        `No participant is available on ${dateLabel(year, month, day)}.`,
      );
    }
  }

  const assignments = Array<number>(days).fill(-1);
  const workloads = Array<number>(normalizedMembers.length).fill(0);
  for (let memberIndex = 0; memberIndex < normalizedMembers.length; memberIndex += 1) {
    const member = normalizedMembers[memberIndex];
    if (member.availableDays.size > MANDATORY_AVAILABILITY_LIMIT) continue;

    for (const day of member.availableDays) {
      const existing = assignments[day - 1];
      if (existing !== -1 && existing !== memberIndex) {
        return failure(
          "INFEASIBLE",
          `Mandatory assignments conflict on ${dateLabel(year, month, day)}.`,
        );
      }
      assignments[day - 1] = memberIndex;
      workloads[memberIndex] += 1;
    }
  }

  for (let dayIndex = 1; dayIndex < days; dayIndex += 1) {
    if (assignments[dayIndex] !== -1 && assignments[dayIndex] === assignments[dayIndex - 1]) {
      return failure(
        "INFEASIBLE",
        `${normalizedMembers[assignments[dayIndex]].name} has mandatory assignments on consecutive days ${dateLabel(year, month, dayIndex)} and ${dateLabel(year, month, dayIndex + 1)}.`,
      );
    }
  }

  const participantCount = normalizedMembers.length;
  const eligibleForDay = (dayIndex: number) =>
    availableMembersByDay[dayIndex].filter(
      (memberIndex) =>
        assignments[dayIndex] === -1 &&
        assignments[dayIndex - 1] !== memberIndex &&
        assignments[dayIndex + 1] !== memberIndex,
    );

  const fairnessScore = (counts: number[]) =>
    counts.reduce(
      (score, count) => score + Math.abs(participantCount * count - days),
      0,
    );

  let bestScore = Number.POSITIVE_INFINITY;
  let bestAssignments: number[] | undefined;
  let bestWorkloads: number[] | undefined;
  let visitedStates = 0;
  let searchLimitReached = false;
  let optimalScoreReached = false;

  const lowerBound = () => {
    let bound = 0;
    const potentialDaysByMember = Array<number>(participantCount).fill(0);
    for (let memberIndex = 0; memberIndex < participantCount; memberIndex += 1) {
      let potentialDays = 0;
      for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
        if (assignments[dayIndex] !== -1) continue;
        if (
          availableMembersByDay[dayIndex].includes(memberIndex) &&
          assignments[dayIndex - 1] !== memberIndex &&
          assignments[dayIndex + 1] !== memberIndex
        ) potentialDays += 1;
      }

      potentialDaysByMember[memberIndex] = potentialDays;
      const minCount = workloads[memberIndex];
      const maxCount = minCount + potentialDays;
      const target = days / participantCount;
      const nearestCounts = [Math.floor(target), Math.ceil(target)].map((count) =>
        Math.max(minCount, Math.min(maxCount, count)),
      );
      bound += Math.min(
        ...nearestCounts.map((count) => Math.abs(participantCount * count - days)),
      );
    }

    const remainingDays = assignments.reduce(
      (count, memberIndex) => count + (memberIndex === -1 ? 1 : 0),
      0,
    );
    const relaxedWorkloads = [...workloads];
    let allocationBound = 0;
    for (let slot = 0; slot < remainingDays; slot += 1) {
      let bestMember = -1;
      let bestChange = Number.POSITIVE_INFINITY;
      for (let memberIndex = 0; memberIndex < participantCount; memberIndex += 1) {
        if (relaxedWorkloads[memberIndex] - workloads[memberIndex] >= potentialDaysByMember[memberIndex]) {
          continue;
        }
        const change =
          Math.abs(participantCount * (relaxedWorkloads[memberIndex] + 1) - days) -
          Math.abs(participantCount * relaxedWorkloads[memberIndex] - days);
        if (change < bestChange) {
          bestMember = memberIndex;
          bestChange = change;
        }
      }
      if (bestMember === -1) return Number.POSITIVE_INFINITY;
      relaxedWorkloads[bestMember] += 1;
      allocationBound += bestChange;
    }

    return Math.max(bound, allocationBound + fairnessScore(workloads));
  };

  const rootLowerBound = lowerBound();

  const search = () => {
    if (optimalScoreReached || searchLimitReached) return;
    visitedStates += 1;
    if (visitedStates > MAX_SEARCH_STATES) {
      searchLimitReached = true;
      return;
    }

    let chosenDay = -1;
    let chosenCandidates: number[] = [];
    for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
      if (assignments[dayIndex] !== -1) continue;
      const candidates = eligibleForDay(dayIndex);
      if (candidates.length === 0) return;
      if (chosenDay === -1 || candidates.length < chosenCandidates.length) {
        chosenDay = dayIndex;
        chosenCandidates = candidates;
      }
    }

    if (chosenDay === -1) {
      const score = fairnessScore(workloads);
      if (score < bestScore) {
        bestScore = score;
        bestAssignments = [...assignments];
        bestWorkloads = [...workloads];
        if (score === rootLowerBound) optimalScoreReached = true;
      }
      return;
    }

    if (bestAssignments && lowerBound() >= bestScore) return;

    chosenCandidates.sort(
      (left, right) =>
        workloads[left] - workloads[right] ||
        (normalizedMembers[left].name < normalizedMembers[right].name ? -1 : 1),
    );

    for (const memberIndex of chosenCandidates) {
      assignments[chosenDay] = memberIndex;
      workloads[memberIndex] += 1;
      search();
      workloads[memberIndex] -= 1;
      assignments[chosenDay] = -1;
      if (optimalScoreReached || searchLimitReached) return;
    }
  };

  try {
    search();
  } catch (error) {
    return failure(
      "INVALID_INPUT",
      error instanceof Error ? error.message : "Availability input is invalid.",
    );
  }

  if (searchLimitReached) {
    return failure(
      "SEARCH_LIMIT",
      `The search reached its ${MAX_SEARCH_STATES.toLocaleString()}-state limit before finding an optimal schedule.`,
      visitedStates,
    );
  }
  if (!bestAssignments) {
    return failure(
      "INFEASIBLE",
      "No schedule satisfies availability, mandatory assignments, and the no-consecutive-days rule.",
      visitedStates,
    );
  }

  const finalWorkloads = normalizedMembers.map((member, memberIndex) => ({
    assignedDays: bestWorkloads?.[memberIndex] ?? 0,
    memberId: member.id,
    name: member.name,
  }));
  const finalAssignments = bestAssignments.map((memberIndex, dayIndex) => ({
    date: dateLabel(year, month, dayIndex + 1),
    day: dayIndex + 1,
    memberId: normalizedMembers[memberIndex].id,
    name: normalizedMembers[memberIndex].name,
  }));

  return {
    ok: true,
    assignments: finalAssignments,
    fairnessScore: bestScore,
    visitedStates,
    workloads: finalWorkloads,
  };
}
