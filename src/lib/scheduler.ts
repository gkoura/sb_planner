export const SCHEDULER_ALGORITHM_VERSION = "v2-shadow";

const MAX_SEARCH_STATES = 250_000;
const MANDATORY_AVAILABILITY_LIMIT = 5;

export type SchedulerMemberInput = {
  id: string;
  name: string;
  mode: "AVAILABLE" | "UNAVAILABLE";
  dates: string[];
  participationMode?: "NORMAL" | "TRAINEE" | "MENTORED";
  shadowDayCount?: number;
};

export type ScheduleAssignmentResult = {
  date: string;
  day: number;
  memberId: string;
  name: string;
};

export type ScheduleShadowResult = {
  date: string;
  shadowMemberId: string;
  name: string;
  kind: "TRAINING" | "MENTORING";
};

export type ScheduleResult =
  | {
      ok: true;
      assignments: ScheduleAssignmentResult[];
      shadows: ScheduleShadowResult[];
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

function generatePrimarySchedule(
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
    shadows: [],
    fairnessScore: bestScore,
    visitedStates,
    workloads: finalWorkloads,
  };
}

const MAX_SHADOW_SEARCH_STATES = 250_000;

export function generateSchedule(
  year: number,
  month: number,
  input: SchedulerMemberInput[],
  fixedPrimaryAssignments?: ScheduleAssignmentResult[],
): ScheduleResult {
  const days = daysInMonth(year, month);
  if (input.length === 0 || input.length > 11) {
    return failure("INVALID_INPUT", "A plan needs between 1 and 11 participants.");
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const member of input) {
    if (!member.id || !member.name.trim() || ids.has(member.id) || names.has(member.name)) {
      return failure("INVALID_INPUT", "Participant names and IDs must be unique and non-empty.");
    }
    if (!["NORMAL", "TRAINEE", "MENTORED", undefined].includes(member.participationMode)) {
      return failure("INVALID_INPUT", `${member.name} has an invalid participation mode.`);
    }
    ids.add(member.id);
    names.add(member.name);
  }
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    return failure("INVALID_INPUT", "Choose a valid planning month.");
  }

  const maxShadowDays = Math.ceil(days / 2);
  for (const member of input) {
    if (member.participationMode === "TRAINEE") {
      if (!Number.isInteger(member.shadowDayCount) || (member.shadowDayCount ?? 0) < 1 || (member.shadowDayCount ?? 0) > maxShadowDays) {
        return failure("INVALID_INPUT", `${member.name} must have between 1 and ${maxShadowDays} trainee shadow days.`);
      }
    }
  }

  const primaryMembers = input.filter((member) => member.participationMode !== "TRAINEE");
  if (primaryMembers.length === 0) {
    return failure("INFEASIBLE", "At least one participant must be available for primary standby assignments.");
  }
  let primaryResult: ScheduleResult;
  if (fixedPrimaryAssignments) {
    const primaryByDate = new Map(fixedPrimaryAssignments.map((assignment) => [assignment.date, assignment]));
    const allDates = Array.from({ length: days }, (_, index) => dateLabel(year, month, index + 1));
    if (
      fixedPrimaryAssignments.length !== days ||
      primaryByDate.size !== days ||
      allDates.some((date) => !primaryByDate.has(date)) ||
      fixedPrimaryAssignments.some((assignment) => !primaryMembers.some((member) => member.id === assignment.memberId))
    ) {
      return failure("INVALID_INPUT", "The fixed primary assignments must cover every date with an eligible participant.");
    }
    primaryResult = {
      ok: true,
      assignments: fixedPrimaryAssignments,
      shadows: [],
      fairnessScore: 0,
      visitedStates: 0,
      workloads: [],
    };
  } else {
    primaryResult = generatePrimarySchedule(year, month, primaryMembers);
  }
  if (!primaryResult.ok) return primaryResult;

  const membersById = new Map(input.map((member) => [member.id, member]));
  const availabilityById = new Map<string, Set<number>>();
  for (const member of input) {
    const selected = new Set<number>();
    for (const date of member.dates) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      if (
        !match || Number(match[1]) !== year || Number(match[2]) !== month ||
        Number(match[3]) < 1 || Number(match[3]) > days || selected.has(Number(match[3]))
      ) {
        return failure("INVALID_INPUT", `${member.name} has an invalid availability date.`);
      }
      selected.add(Number(match[3]));
    }
    availabilityById.set(member.id, new Set(
      member.mode === "AVAILABLE"
        ? selected
        : Array.from({ length: days }, (_, index) => index + 1).filter((day) => !selected.has(day)),
    ));
  }

  const primaryByDay = new Map(primaryResult.assignments.map((assignment) => [assignment.day, assignment.memberId]));
  const workDaysByMember = new Map<string, Set<number>>(
    input.map((member) => [member.id, new Set<number>()]),
  );
  for (const assignment of primaryResult.assignments) {
    workDaysByMember.get(assignment.memberId)!.add(assignment.day);
  }
  const shadowCountByMember = new Map(input.map((member) => [member.id, 0]));
  const trainingMentorsByTrainee = new Map(input.map((member) => [member.id, new Map<string, number>()]));
  const occupiedShadowDates = new Set<number>();
  const shadows: ScheduleShadowResult[] = [];
  let shadowStates = 0;
  let shadowLimitReached = false;

  const tasks: (
    | { kind: "MENTORING"; day: number; shadowMemberId: string; shadowedMemberId: string }
    | { kind: "TRAINING"; shadowMemberId: string }
  )[] = [];
  for (const assignment of primaryResult.assignments) {
    const member = membersById.get(assignment.memberId)!;
    if (member.participationMode === "MENTORED") {
      tasks.push({ kind: "MENTORING", day: assignment.day, shadowMemberId: "", shadowedMemberId: member.id });
    }
  }
  const traineeMembers = input
    .filter((member) => member.participationMode === "TRAINEE")
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const trainee of traineeMembers) {
    for (let index = 0; index < (trainee.shadowDayCount ?? 0); index += 1) {
      tasks.push({ kind: "TRAINING", shadowMemberId: trainee.id });
    }
  }

  const mentorCandidatesFor = (task: (typeof tasks)[number]) => {
    if (task.kind === "TRAINING") return [];
    return primaryMembers
      .filter((member) => member.id !== task.shadowedMemberId)
      .filter((member) => availabilityById.get(member.id)!.has(task.day))
      .filter((member) => {
        const workDays = workDaysByMember.get(member.id)!;
        return !workDays.has(task.day - 1) && !workDays.has(task.day) && !workDays.has(task.day + 1);
      });
  };

  const orderedTasks = [
    ...tasks.filter((task) => task.kind === "MENTORING").sort((left, right) => {
      if (left.kind !== "MENTORING" || right.kind !== "MENTORING") return 0;
      return mentorCandidatesFor(left).length - mentorCandidatesFor(right).length || left.day - right.day;
    }),
    ...tasks.filter((task) => task.kind === "TRAINING"),
  ];

  const canWork = (memberId: string, day: number) => {
    const workDays = workDaysByMember.get(memberId)!;
    return !workDays.has(day - 1) && !workDays.has(day) && !workDays.has(day + 1);
  };

  const searchShadows = (taskIndex: number): boolean => {
    shadowStates += 1;
    if (shadowStates > MAX_SHADOW_SEARCH_STATES) {
      shadowLimitReached = true;
      return false;
    }
    if (taskIndex >= orderedTasks.length) return true;
    const task = orderedTasks[taskIndex];

    if (task.kind === "MENTORING") {
      const candidates = mentorCandidatesFor(task).sort((left, right) =>
        shadowCountByMember.get(left.id)! - shadowCountByMember.get(right.id)! ||
        left.name.localeCompare(right.name),
      );
      if (occupiedShadowDates.has(task.day)) return false;
      for (const mentor of candidates) {
        workDaysByMember.get(mentor.id)!.add(task.day);
        occupiedShadowDates.add(task.day);
        shadowCountByMember.set(mentor.id, shadowCountByMember.get(mentor.id)! + 1);
        shadows.push({
          date: primaryResult.assignments[task.day - 1].date,
          shadowMemberId: mentor.id,
          name: mentor.name,
          kind: "MENTORING",
        });
        if (searchShadows(taskIndex + 1)) return true;
        shadows.pop();
        shadowCountByMember.set(mentor.id, shadowCountByMember.get(mentor.id)! - 1);
        occupiedShadowDates.delete(task.day);
        workDaysByMember.get(mentor.id)!.delete(task.day);
        if (shadowLimitReached) return false;
      }
      return false;
    }

    const traineeId = task.shadowMemberId;
    const trainee = membersById.get(traineeId)!;
    const availableDays = Array.from(primaryByDay.keys())
      .filter((day) => availabilityById.get(traineeId)!.has(day) && canWork(traineeId, day))
      .sort((left, right) => {
        const leftMentor = primaryByDay.get(left)!;
        const rightMentor = primaryByDay.get(right)!;
        const leftRepeat = trainingMentorsByTrainee.get(traineeId)!.get(leftMentor) ?? 0;
        const rightRepeat = trainingMentorsByTrainee.get(traineeId)!.get(rightMentor) ?? 0;
        if (leftRepeat !== rightRepeat) return leftRepeat - rightRepeat;

        const priorDays = shadows
          .filter((shadow) => shadow.kind === "TRAINING" && shadow.shadowMemberId === traineeId)
          .map((shadow) => Number(shadow.date.slice(-2)));
        const leftSpacing = priorDays.length
          ? Math.min(...priorDays.map((day) => Math.abs(day - left)))
          : -Math.abs(left - (days + 1) / 2);
        const rightSpacing = priorDays.length
          ? Math.min(...priorDays.map((day) => Math.abs(day - right)))
          : -Math.abs(right - (days + 1) / 2);
        return rightSpacing - leftSpacing || left - right;
      });

    for (const day of availableDays) {
      const mentorId = primaryByDay.get(day)!;
      if (occupiedShadowDates.has(day)) continue;
      workDaysByMember.get(traineeId)!.add(day);
      occupiedShadowDates.add(day);
      const mentorCounts = trainingMentorsByTrainee.get(traineeId)!;
      mentorCounts.set(mentorId, (mentorCounts.get(mentorId) ?? 0) + 1);
      shadows.push({
        date: primaryResult.assignments[day - 1].date,
        shadowMemberId: trainee.id,
        name: trainee.name,
        kind: "TRAINING",
      });
      if (searchShadows(taskIndex + 1)) return true;
      shadows.pop();
      const remaining = mentorCounts.get(mentorId)! - 1;
      if (remaining) mentorCounts.set(mentorId, remaining);
      else mentorCounts.delete(mentorId);
      occupiedShadowDates.delete(day);
      workDaysByMember.get(traineeId)!.delete(day);
      if (shadowLimitReached) return false;
    }
    return false;
  };

  if (!searchShadows(0)) {
    if (shadowLimitReached) {
      return failure("SEARCH_LIMIT", "Shadow assignments reached the search limit before finding a conflict-free arrangement.", primaryResult.visitedStates + shadowStates);
    }
    return failure(
      "INFEASIBLE",
      "No shadow plan satisfies availability, mentor capacity, and the no-consecutive-days rule. Review shadow counts or participant availability.",
      primaryResult.visitedStates + shadowStates,
    );
  }

  return {
    ...primaryResult,
    assignments: primaryResult.assignments,
    shadows: [...shadows].sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name)),
    visitedStates: primaryResult.visitedStates + shadowStates,
  };
}

export function generateShadowsForAssignments(
  year: number,
  month: number,
  members: SchedulerMemberInput[],
  assignments: { date: string; planningMemberId: string }[],
): { ok: true; shadows: ScheduleShadowResult[] } | { ok: false; message: string } {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const fixedAssignments = assignments.map((assignment) => {
    const day = Number(assignment.date.slice(-2));
    const member = memberById.get(assignment.planningMemberId);
    return {
      date: assignment.date,
      day,
      memberId: assignment.planningMemberId,
      name: member?.name ?? "",
    };
  });
  const result = generateSchedule(year, month, members, fixedAssignments);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, shadows: result.shadows };
}
