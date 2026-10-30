import { daysInCalendarMonth } from "@/lib/calendar-date";
import {
    getAvailableDates,
    validateScheduleEdit,
    validateShadowAvailability,
    type ScheduleInputMember,
} from "@/lib/schedule-edits";

export type ScheduleImportRosterMember = {
    id: string;
    nameSnapshot: string;
    emailSnapshot: string;
    roleSnapshot: string;
    participationMode: "NORMAL" | "TRAINEE" | "MENTORED";
    shadowDayCount: number;
    availabilitySubmission: {
        mode: "AVAILABLE" | "UNAVAILABLE";
        dates: string[];
    } | null;
};

export type ImportedScheduleAssignment = {
    date: string;
    planningMemberId: string;
    nameSnapshot: string;
    roleSnapshot: string;
    shadows: {
        id: string;
        shadowMemberId: string;
        nameSnapshot: string;
        roleSnapshot: string;
        kind: "TRAINING" | "MENTORING";
    }[];
};

export type ScheduleImportValidation =
    | { ok: false; errors: string[] }
    | {
          ok: true;
          assignments: ImportedScheduleAssignment[];
          inputMembers: ScheduleInputMember[];
          warnings: string[];
          fairnessScore: number;
          workloads: { assignedDays: number; memberId: string; name: string }[];
      };

const MAX_CSV_LENGTH = 64_000;
const REQUIRED_HEADERS = [
    "date",
    "primary_email",
    "shadow_email",
    "shadow_kind",
];

function dateForDay(year: number, month: number, day: number) {
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseCsvRows(source: string): { rows?: string[][]; error?: string } {
    if (source.length > MAX_CSV_LENGTH) {
        return { error: "The CSV file is too large. Keep it under 64 KB." };
    }

    const text = source.replace(/^\uFEFF/, "");
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];

        if (quoted) {
            if (character === '"') {
                if (text[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else {
                    quoted = false;
                }
            } else {
                field += character;
            }
            continue;
        }

        if (character === '"') {
            if (field.trim()) {
                return {
                    error: "The CSV contains a misplaced quotation mark.",
                };
            }
            field = "";
            quoted = true;
        } else if (character === ",") {
            row.push(field.trim());
            field = "";
        } else if (character === "\n" || character === "\r") {
            if (character === "\r" && text[index + 1] === "\n") index += 1;
            row.push(field.trim());
            if (row.some(Boolean)) rows.push(row);
            row = [];
            field = "";
        } else {
            field += character;
        }
    }

    if (quoted) return { error: "The CSV has an unclosed quoted field." };
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);

    if (rows.length === 0) return { error: "The CSV file is empty." };
    return { rows };
}

export function validateScheduleCsvImport(
    csvText: string,
    year: number,
    month: number,
    roster: ScheduleImportRosterMember[],
): ScheduleImportValidation {
    const parsedCsv = parseCsvRows(csvText);
    if (!parsedCsv.rows) return { ok: false, errors: [parsedCsv.error!] };

    const [headers, ...rows] = parsedCsv.rows;
    const normalizedHeaders = headers.map((header) => header.toLowerCase());
    if (
        normalizedHeaders.length !== REQUIRED_HEADERS.length ||
        REQUIRED_HEADERS.some(
            (header, index) => normalizedHeaders[index] !== header,
        )
    ) {
        return {
            ok: false,
            errors: [
                `Use these columns in this order: ${REQUIRED_HEADERS.join(", ")}.`,
            ],
        };
    }

    const days = daysInCalendarMonth(year, month);
    const allDates = Array.from({ length: days }, (_, index) =>
        dateForDay(year, month, index + 1),
    );
    const memberByEmail = new Map<string, ScheduleImportRosterMember>();
    const errors: string[] = [];

    for (const member of roster) {
        const email = member.emailSnapshot.trim().toLowerCase();
        if (memberByEmail.has(email)) {
            errors.push(
                `The month roster has more than one member with ${email}.`,
            );
        } else {
            memberByEmail.set(email, member);
        }
    }

    if (rows.length !== days) {
        errors.push(`Add exactly ${days} schedule rows, one for each date.`);
    }

    const seenDates = new Set<string>();
    const stagedAssignments: {
        date: string;
        primary: ScheduleImportRosterMember;
        shadow?: ScheduleImportRosterMember;
        shadowKind?: "TRAINING" | "MENTORING";
    }[] = [];

    rows.forEach((row, index) => {
        const rowNumber = index + 2;
        if (row.length !== REQUIRED_HEADERS.length) {
            errors.push(`Row ${rowNumber} must contain exactly four columns.`);
            return;
        }

        const [date, primaryEmailValue, shadowEmailValue, shadowKindValue] =
            row;
        const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
        const dateMatch = datePattern.exec(date);
        if (!dateMatch) {
            errors.push(`Row ${rowNumber} needs a date in YYYY-MM-DD format.`);
            return;
        }

        const dateYear = Number(dateMatch[1]);
        const dateMonth = Number(dateMatch[2]);
        const day = Number(dateMatch[3]);
        if (
            dateYear !== year ||
            dateMonth !== month ||
            day < 1 ||
            day > days ||
            date !== dateForDay(year, month, day)
        ) {
            errors.push(`Row ${rowNumber} date ${date} is outside this month.`);
            return;
        }
        if (seenDates.has(date)) {
            errors.push(`Date ${date} appears more than once.`);
            return;
        }
        seenDates.add(date);

        const primaryEmail = primaryEmailValue.trim().toLowerCase();
        const primary = memberByEmail.get(primaryEmail);
        if (!primary) {
            errors.push(
                primaryEmail
                    ? `Row ${rowNumber} primary email ${primaryEmail} is not in this month's roster.`
                    : `Choose a primary email for ${date}.`,
            );
            return;
        }

        const shadowEmail = shadowEmailValue.trim().toLowerCase();
        const shadowKindText = shadowKindValue.trim().toUpperCase();
        if (Boolean(shadowEmail) !== Boolean(shadowKindText)) {
            errors.push(
                `Row ${rowNumber} must include both shadow_email and shadow_kind, or leave both blank.`,
            );
            return;
        }

        let shadow: ScheduleImportRosterMember | undefined;
        let shadowKind: "TRAINING" | "MENTORING" | undefined;
        if (shadowEmail) {
            shadow = memberByEmail.get(shadowEmail);
            if (!shadow) {
                errors.push(
                    `Row ${rowNumber} shadow email ${shadowEmail} is not in this month's roster.`,
                );
                return;
            }
            if (
                shadowKindText !== "TRAINING" &&
                shadowKindText !== "MENTORING"
            ) {
                errors.push(
                    `Row ${rowNumber} shadow_kind must be TRAINING or MENTORING.`,
                );
                return;
            }
            shadowKind = shadowKindText;
            if (shadow.id === primary.id) {
                errors.push(
                    `A member cannot shadow their own assignment on ${date}.`,
                );
                return;
            }
        }

        stagedAssignments.push({ date, primary, shadow, shadowKind });
    });

    const missingDates = allDates.filter((date) => !seenDates.has(date));
    if (missingDates.length > 0) {
        errors.push(`Missing dates: ${missingDates.join(", ")}.`);
    }
    if (errors.length > 0) return { ok: false, errors: errors.slice(0, 10) };

    const inputMembers: ScheduleInputMember[] = roster.map((member) => ({
        id: member.id,
        name: member.nameSnapshot,
        mode: member.availabilitySubmission?.mode ?? "UNAVAILABLE",
        dates: member.availabilitySubmission?.dates ?? [],
        participationMode: member.participationMode,
        shadowDayCount: member.shadowDayCount,
        availabilitySubmitted: Boolean(member.availabilitySubmission),
    }));
    const primaryAssignments = stagedAssignments.map((assignment) => ({
        date: assignment.date,
        planningMemberId: assignment.primary.id,
    }));
    const primaryValidation = validateScheduleEdit(
        year,
        month,
        inputMembers,
        primaryAssignments,
    );
    if (!primaryValidation.ok) {
        return { ok: false, errors: primaryValidation.errors.slice(0, 10) };
    }

    const traineeShadowCounts = new Map<string, number>();
    const warnings = new Set(primaryValidation.warnings);
    const shadowDatesByMember = new Map<string, Set<string>>(
        roster.map((member) => [member.id, new Set<string>()]),
    );
    const workDatesByMember = new Map<string, Set<string>>(
        roster.map((member) => [member.id, new Set<string>()]),
    );
    const availableDatesByMember = new Map(
        inputMembers.map((member) => [
            member.id,
            getAvailableDates(year, month, member),
        ]),
    );
    const assignmentByDate = new Map(
        stagedAssignments.map((assignment) => [assignment.date, assignment]),
    );
    const shadowAssignments: ImportedScheduleAssignment[] = [];
    const shadowErrors: string[] = [];

    for (const assignment of stagedAssignments) {
        workDatesByMember.get(assignment.primary.id)!.add(assignment.date);
        const primaryMode = assignment.primary.participationMode;
        if (
            primaryMode === "MENTORED" &&
            assignment.shadowKind !== "MENTORING"
        ) {
            shadowErrors.push(
                `${assignment.primary.nameSnapshot} needs a MENTORING partner on ${assignment.date}.`,
            );
        }
        if (assignment.shadow && assignment.shadowKind) {
            if (assignment.shadow.id === assignment.primary.id) {
                shadowErrors.push(
                    `${assignment.primary.nameSnapshot} cannot be both primary and shadow on ${assignment.date}.`,
                );
            }
            if (assignment.shadowKind === "TRAINING") {
                if (assignment.shadow.participationMode !== "TRAINEE") {
                    shadowErrors.push(
                        `${assignment.shadow.nameSnapshot} must be configured as a trainee before importing training shadows.`,
                    );
                }
                if (primaryMode !== "NORMAL") {
                    shadowErrors.push(
                        `A training shadow on ${assignment.date} needs a normal primary participant.`,
                    );
                }
                traineeShadowCounts.set(
                    assignment.shadow.id,
                    (traineeShadowCounts.get(assignment.shadow.id) ?? 0) + 1,
                );
            } else {
                if (primaryMode !== "MENTORED") {
                    shadowErrors.push(
                        `${assignment.primary.nameSnapshot} must be configured as mentored before importing a MENTORING pair.`,
                    );
                }
                if (assignment.shadow.participationMode === "TRAINEE") {
                    shadowErrors.push(
                        `${assignment.shadow.nameSnapshot} cannot mentor on ${assignment.date} because they are configured as a trainee.`,
                    );
                }
            }

            workDatesByMember.get(assignment.shadow.id)!.add(assignment.date);
            shadowDatesByMember.get(assignment.shadow.id)!.add(assignment.date);
            const inputMember = inputMembers.find(
                (member) => member.id === assignment.shadow!.id,
            );
            if (
                inputMember?.availabilitySubmitted !== false &&
                !availableDatesByMember
                    .get(assignment.shadow.id)
                    ?.has(assignment.date)
            ) {
                shadowErrors.push(
                    `${assignment.shadow.nameSnapshot} is unavailable for a shadow duty on ${assignment.date}.`,
                );
            }

            shadowAssignments.push({
                date: assignment.date,
                planningMemberId: assignment.primary.id,
                nameSnapshot: assignment.primary.nameSnapshot,
                roleSnapshot: assignment.primary.roleSnapshot,
                shadows: [
                    {
                        id: `${assignment.date}:${assignment.shadow.id}`,
                        shadowMemberId: assignment.shadow.id,
                        nameSnapshot: assignment.shadow.nameSnapshot,
                        roleSnapshot: assignment.shadow.roleSnapshot,
                        kind: assignment.shadowKind,
                    },
                ],
            });
        } else {
            shadowAssignments.push({
                date: assignment.date,
                planningMemberId: assignment.primary.id,
                nameSnapshot: assignment.primary.nameSnapshot,
                roleSnapshot: assignment.primary.roleSnapshot,
                shadows: [],
            });
        }
    }

    for (const member of roster) {
        if (member.participationMode === "TRAINEE") {
            const importedCount = traineeShadowCounts.get(member.id) ?? 0;
            if (importedCount !== member.shadowDayCount) {
                shadowErrors.push(
                    `${member.nameSnapshot} has ${member.shadowDayCount} training shadow day(s) configured, but the CSV contains ${importedCount}. Update the month settings or CSV.`,
                );
            }
        }
    }

    for (const assignment of stagedAssignments) {
        if (!assignment.shadow || !assignment.shadowKind) continue;
        const primaryDate = assignment.date;
        if (workDatesByMember.get(assignment.shadow.id)?.has(primaryDate)) {
            const sameDayPrimary = assignmentByDate.get(primaryDate);
            if (sameDayPrimary?.primary.id === assignment.shadow.id) {
                shadowErrors.push(
                    `${assignment.shadow.nameSnapshot} cannot have a primary and shadow duty on ${primaryDate}.`,
                );
            }
        }
    }

    for (const [memberId, workDates] of workDatesByMember) {
        const sortedDates = [...workDates].sort();
        const member = roster.find((candidate) => candidate.id === memberId)!;
        for (let index = 1; index < sortedDates.length; index += 1) {
            const previous = sortedDates[index - 1];
            const current = sortedDates[index];
            const difference =
                (Date.parse(`${current}T00:00:00Z`) -
                    Date.parse(`${previous}T00:00:00Z`)) /
                86_400_000;
            if (difference === 1) {
                const hasShadowConflict =
                    shadowDatesByMember.get(memberId)?.has(previous) ||
                    shadowDatesByMember.get(memberId)?.has(current);
                const message = `${member.nameSnapshot} has consecutive primary or shadow duties on ${previous} and ${current}.`;
                if (hasShadowConflict) shadowErrors.push(message);
            }
        }
    }

    shadowErrors.push(
        ...validateShadowAvailability(
            year,
            month,
            inputMembers,
            shadowAssignments,
        ),
    );
    if (shadowErrors.length > 0) {
        return { ok: false, errors: [...new Set(shadowErrors)].slice(0, 10) };
    }

    return {
        ok: true,
        assignments: shadowAssignments,
        inputMembers,
        warnings: [...warnings],
        fairnessScore: primaryValidation.fairnessScore,
        workloads: primaryValidation.workloads,
    };
}
