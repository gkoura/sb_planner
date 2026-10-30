export type ScheduleInputMember = {
    id: string;
    name: string;
    mode: "AVAILABLE" | "UNAVAILABLE";
    dates: string[];
    availabilitySubmitted?: boolean;
    participationMode?: "NORMAL" | "TRAINEE" | "MENTORED";
    shadowDayCount?: number;
};

export type ScheduleInputSnapshot = {
    members: ScheduleInputMember[];
    month: number;
    year: number;
    source?: "CSV_IMPORT";
};

export type ScheduleEditAssignment = {
    date: string;
    planningMemberId: string;
};

export type ScheduleEditValidation =
    | {
          ok: true;
          warnings: string[];
          fairnessScore: number;
          workloads: { assignedDays: number; memberId: string; name: string }[];
      }
    | { ok: false; errors: string[]; warnings: string[] };

function daysInMonth(year: number, month: number) {
    if (month === 2) {
        const leapYear =
            year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
        return leapYear ? 29 : 28;
    }
    return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseScheduleInputSnapshot(
    value: string,
): ScheduleInputSnapshot | null {
    try {
        const parsed: unknown = JSON.parse(value);
        if (!parsed || typeof parsed !== "object") return null;
        const candidate = parsed as Partial<ScheduleInputSnapshot>;
        if (
            !Number.isInteger(candidate.year) ||
            !Number.isInteger(candidate.month) ||
            !Array.isArray(candidate.members) ||
            candidate.members.length === 0 ||
            (candidate.source !== undefined &&
                candidate.source !== "CSV_IMPORT")
        )
            return null;

        const members = candidate.members.map((member) => {
            const participationMode = member?.participationMode ?? "NORMAL";
            const shadowDayCount = member?.shadowDayCount ?? 0;
            if (
                !member ||
                typeof member.id !== "string" ||
                typeof member.name !== "string" ||
                !["AVAILABLE", "UNAVAILABLE"].includes(member.mode) ||
                !Array.isArray(member.dates) ||
                member.dates.some((date) => typeof date !== "string") ||
                (member.availabilitySubmitted !== undefined &&
                    typeof member.availabilitySubmitted !== "boolean") ||
                !["NORMAL", "TRAINEE", "MENTORED"].includes(
                    participationMode,
                ) ||
                !Number.isInteger(shadowDayCount) ||
                shadowDayCount < 0
            )
                return null;
            return {
                ...member,
                participationMode,
                shadowDayCount,
            } as ScheduleInputMember;
        });
        if (members.some((member) => member === null)) return null;

        return {
            members: members as ScheduleInputMember[],
            month: candidate.month as number,
            year: candidate.year as number,
            ...(candidate.source ? { source: candidate.source } : {}),
        };
    } catch {
        return null;
    }
}

export function getAvailableDates(
    year: number,
    month: number,
    member: ScheduleInputMember,
) {
    const totalDays = daysInMonth(year, month);
    const selectedDates = new Set(member.dates);
    if (member.mode === "AVAILABLE") return selectedDates;

    const available = new Set<string>();
    for (let day = 1; day <= totalDays; day += 1) {
        const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (!selectedDates.has(date)) available.add(date);
    }
    return available;
}

/** Checks availability only for dates that actually contain a shadow pair. */
export function validateShadowAvailability(
    year: number,
    month: number,
    members: ScheduleInputMember[],
    assignments: (ScheduleEditAssignment & {
        shadows: { shadowMemberId: string }[];
    })[],
): string[] {
    const memberById = new Map(members.map((member) => [member.id, member]));
    const available = new Map(
        members.map((member) => [
            member.id,
            getAvailableDates(year, month, member),
        ]),
    );
    const errors = new Set<string>();
    for (const assignment of assignments) {
        if (!assignment.shadows.length) continue;
        for (const id of [
            assignment.planningMemberId,
            ...assignment.shadows.map((shadow) => shadow.shadowMemberId),
        ]) {
            const member = memberById.get(id);
            if (!member) {
                errors.add(
                    `A shadow pair on ${assignment.date} has an unknown participant.`,
                );
            } else if (
                member.availabilitySubmitted !== false &&
                !available.get(id)?.has(assignment.date)
            ) {
                errors.add(
                    `${member.name} is unavailable for a shadow pair on ${assignment.date}.`,
                );
            }
        }
    }
    return [...errors];
}

export function validateScheduleEdit(
    year: number,
    month: number,
    members: ScheduleInputMember[],
    assignments: ScheduleEditAssignment[],
): ScheduleEditValidation {
    const totalDays = daysInMonth(year, month);
    const allDates = Array.from(
        { length: totalDays },
        (_, index) =>
            `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
    );
    const errors: string[] = [];
    const warnings: string[] = [];
    const memberById = new Map(members.map((member) => [member.id, member]));
    const primaryMembers = members.filter(
        (member) => member.participationMode !== "TRAINEE",
    );
    const availableDatesByMember = new Map(
        members.map((member) => [
            member.id,
            getAvailableDates(year, month, member),
        ]),
    );
    const assignmentByDate = new Map<string, string>();

    for (const assignment of assignments) {
        if (!allDates.includes(assignment.date)) {
            errors.push(
                `The date ${assignment.date} is outside this planning month.`,
            );
            continue;
        }
        if (assignmentByDate.has(assignment.date)) {
            errors.push(
                `There is more than one assignment for ${assignment.date}.`,
            );
            continue;
        }
        if (!memberById.has(assignment.planningMemberId)) {
            errors.push(
                `The selected participant for ${assignment.date} is not in this month.`,
            );
            continue;
        }
        if (
            memberById.get(assignment.planningMemberId)?.participationMode ===
            "TRAINEE"
        ) {
            errors.push(
                `${memberById.get(assignment.planningMemberId)?.name} is configured as a trainee and cannot receive a primary assignment.`,
            );
            continue;
        }
        assignmentByDate.set(assignment.date, assignment.planningMemberId);
    }

    for (const date of allDates) {
        const memberId = assignmentByDate.get(date);
        if (!memberId) {
            errors.push(`Assign a participant to ${date}.`);
            continue;
        }
        if (
            memberById.get(memberId)?.availabilitySubmitted !== false &&
            !availableDatesByMember.get(memberId)?.has(date)
        ) {
            const name =
                memberById.get(memberId)?.name ?? "The selected participant";
            warnings.push(`${name} is unavailable on ${date}.`);
        }
    }

    for (let day = 1; day < totalDays; day += 1) {
        const date = allDates[day - 1];
        const nextDate = allDates[day];
        const memberId = assignmentByDate.get(date);
        if (memberId && memberId === assignmentByDate.get(nextDate)) {
            const name = memberById.get(memberId)?.name ?? "A participant";
            warnings.push(
                `${name} cannot cover consecutive days ${date} and ${nextDate}.`,
            );
        }
    }

    for (const member of primaryMembers) {
        if (member.availabilitySubmitted === false) continue;
        const availableDates = availableDatesByMember.get(member.id);
        if (!availableDates || availableDates.size > 5) continue;
        for (const date of availableDates) {
            if (assignmentByDate.get(date) !== member.id) {
                warnings.push(
                    `${member.name} must be assigned on ${date} under the mandatory availability rule.`,
                );
            }
        }
    }

    if (errors.length > 0) return { ok: false, errors, warnings };

    const counts = new Map(primaryMembers.map((member) => [member.id, 0]));
    for (const memberId of assignmentByDate.values()) {
        counts.set(memberId, (counts.get(memberId) ?? 0) + 1);
    }
    const participantCount = primaryMembers.length;
    const fairnessScore = primaryMembers.reduce(
        (score, member) =>
            score +
            Math.abs(
                participantCount * (counts.get(member.id) ?? 0) - totalDays,
            ),
        0,
    );

    return {
        ok: true,
        warnings,
        fairnessScore,
        workloads: members.map((member) => ({
            assignedDays: counts.get(member.id) ?? 0,
            memberId: member.id,
            name: member.name,
        })),
    };
}

export function parseScheduleWarnings(value: string | null | undefined) {
    if (!value) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) &&
            parsed.every((warning) => typeof warning === "string")
            ? parsed
            : [];
    } catch {
        return [];
    }
}

export function getOperationalDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "Europe/Athens",
        year: "numeric",
    }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((entry) => entry.type === type)?.value ?? "00";
    return `${part("year")}-${part("month")}-${part("day")}`;
}

export type ScheduleEditShadow = {
    date: string;
    shadowMemberId: string;
    kind: "TRAINING" | "MENTORING";
};

export function scheduleShadowSignature(
    shadows: { shadowMemberId: string; kind: string }[],
) {
    return shadows
        .map((shadow) => `${shadow.kind}:${shadow.shadowMemberId}`)
        .sort()
        .join("|");
}

/** Shadow rules are hard constraints even when a primary-only exception is approved. */
export function validateScheduleShadows(
    year: number,
    month: number,
    members: ScheduleInputMember[],
    assignments: ScheduleEditAssignment[],
    shadows: ScheduleEditShadow[],
): string[] {
    const errors = new Set<string>();
    const memberById = new Map(members.map((member) => [member.id, member]));
    const byDate = new Map(
        assignments.map((assignment) => [assignment.date, assignment]),
    );
    const shadowByDate = new Map<string, ScheduleEditShadow>();
    const traineeCounts = new Map<string, number>();
    const workDates = new Map(
        members.map((member) => [member.id, new Set<string>()]),
    );
    const shadowWorkDates = new Map(
        members.map((member) => [member.id, new Set<string>()]),
    );
    for (const assignment of assignments)
        workDates.get(assignment.planningMemberId)?.add(assignment.date);
    for (const shadow of shadows) {
        const assignment = byDate.get(shadow.date);
        const member = memberById.get(shadow.shadowMemberId);
        const primary =
            assignment && memberById.get(assignment.planningMemberId);
        if (!assignment || !member || !primary) {
            errors.add(
                `A shadow pair on ${shadow.date} has an unknown date or participant.`,
            );
            continue;
        }
        if (shadowByDate.has(shadow.date))
            errors.add(`Only one shadow pair is allowed on ${shadow.date}.`);
        shadowByDate.set(shadow.date, shadow);
        if (primary.id === member.id)
            errors.add(
                `${member.name} cannot be both primary and shadow on ${shadow.date}.`,
            );
        if (shadow.kind === "TRAINING") {
            if (
                member.participationMode !== "TRAINEE" ||
                (primary.participationMode ?? "NORMAL") !== "NORMAL"
            ) {
                errors.add(
                    `Training on ${shadow.date} requires a trainee and a normal primary participant.`,
                );
            }
            traineeCounts.set(
                member.id,
                (traineeCounts.get(member.id) ?? 0) + 1,
            );
        } else if (shadow.kind === "MENTORING") {
            if (
                primary.participationMode !== "MENTORED" ||
                member.participationMode === "TRAINEE"
            ) {
                errors.add(
                    `Mentoring on ${shadow.date} requires a mentored primary and a non-trainee mentor.`,
                );
            }
        } else errors.add(`Choose a valid shadow kind on ${shadow.date}.`);
        workDates.get(member.id)?.add(shadow.date);
        shadowWorkDates.get(member.id)?.add(shadow.date);
    }
    for (const assignment of assignments) {
        const member = memberById.get(assignment.planningMemberId);
        if (
            member?.participationMode === "MENTORED" &&
            shadowByDate.get(assignment.date)?.kind !== "MENTORING"
        ) {
            errors.add(
                `${member.name} needs a MENTORING partner on ${assignment.date}.`,
            );
        }
    }
    for (const member of members) {
        if (
            member.participationMode === "TRAINEE" &&
            (traineeCounts.get(member.id) ?? 0) !== (member.shadowDayCount ?? 0)
        ) {
            errors.add(
                `${member.name} needs exactly ${member.shadowDayCount ?? 0} training shadow day(s); currently assigned ${traineeCounts.get(member.id) ?? 0}.`,
            );
        }
        const dates = [...(workDates.get(member.id) ?? [])].sort();
        for (let index = 1; index < dates.length; index++) {
            const previous = dates[index - 1];
            const current = dates[index];
            if (
                Date.parse(`${current}T00:00:00Z`) -
                    Date.parse(`${previous}T00:00:00Z`) ===
                    86_400_000 &&
                (shadowWorkDates.get(member.id)?.has(previous) ||
                    shadowWorkDates.get(member.id)?.has(current))
            ) {
                errors.add(
                    `${member.name} has consecutive primary or shadow duties on ${previous} and ${current}.`,
                );
            }
        }
    }
    validateShadowAvailability(
        year,
        month,
        members,
        assignments.map((assignment) => ({
            ...assignment,
            shadows: shadows.filter(
                (shadow) => shadow.date === assignment.date,
            ),
        })),
    ).forEach((error) => errors.add(error));
    return [...errors];
}
