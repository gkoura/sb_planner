import { dutyDate, parseAthensDateTime, callOutDuration } from "./call-outs";

export const CALL_OUT_IMPORT_TEMPLATE =
    [
        "reason,duty_role,start_athens,end_athens",
        "Example: server alert,PRIMARY,2026-10-21T23:00,2026-10-22T01:30",
        "Example: helping a colleague,SUPPORT,2026-10-24T10:15,2026-10-24T10:45",
    ].join("\r\n") + "\r\n";
const headers = ["reason", "duty_role", "start_athens", "end_athens"];
type Role = "PRIMARY" | "TRAINEE" | "MENTOR" | "SUPPORT" | "OVERTIME";
export type ImportEntry = {
    reason: string;
    role: Role;
    start: string;
    end: string;
    dutyDate: string | null;
    duration: ReturnType<typeof callOutDuration>;
};

// Strict CSV parser: quoted fields may contain commas, line breaks and escaped quotes.
function parseCsv(input: string): string[][] | null {
    const rows: string[][] = [];
    let row: string[] = [],
        field = "",
        quoted = false,
        closed = false;
    const text = input.replace(/^\uFEFF/, "");
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (c === '"') {
                quoted = false;
                closed = true;
            } else field += c;
        } else if (c === '"') {
            if (field.length || closed) return null;
            quoted = true;
        } else if (c === "," || c === "\r" || c === "\n") {
            row.push(field.trim());
            field = "";
            closed = false;
            if (c !== ",") {
                if (c === "\r" && text[i + 1] === "\n") i++;
                if (row.some(Boolean)) rows.push(row);
                row = [];
            }
        } else {
            if (closed) return null;
            field += c;
        }
    }
    if (quoted) return null;
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
}

export function validateCallOutImport(text: string): {
    entries: ImportEntry[];
    errors: string[];
} {
    if (text.length > 256000)
        return {
            entries: [],
            errors: ["The file is too large. Use a CSV under 256 KB."],
        };
    const rows = parseCsv(text);
    if (!rows)
        return {
            entries: [],
            errors: ["The CSV contains malformed quotation marks."],
        };
    if (
        !rows.length ||
        rows[0].length !== headers.length ||
        headers.some((header, index) => rows[0][index].toLowerCase() !== header)
    )
        return {
            entries: [],
            errors: [`Use these columns in order: ${headers.join(", ")}.`],
        };
    if (rows.length < 2 || rows.length > 1001)
        return {
            entries: [],
            errors: ["Add between 1 and 1,000 call-outs per file."],
        };
    const entries: ImportEntry[] = [],
        errors: string[] = [],
        seen = new Set<string>();
    rows.slice(1).forEach((row, index) => {
        const number = index + 2;
        if (row.length !== 4) {
            errors.push(`Row ${number}: expected four columns.`);
            return;
        }
        const [reason, roleValue, start, end] = row;
        const role = roleValue.toUpperCase();
        const startDate = parseAthensDateTime(start),
            endDate = parseAthensDateTime(end);
        if (!reason || reason.length > 2000) {
            errors.push(
                `Row ${number}: reason must contain 1–2,000 characters.`,
            );
            return;
        }
        if (
            !(
                [
                    "PRIMARY",
                    "TRAINEE",
                    "MENTOR",
                    "SUPPORT",
                    "OVERTIME",
                ] as string[]
            ).includes(role)
        ) {
            errors.push(
                `Row ${number}: duty role must be PRIMARY, TRAINEE, MENTOR, SUPPORT or OVERTIME.`,
            );
            return;
        }
        if (
            !startDate ||
            !endDate ||
            endDate <= startDate ||
            endDate.getTime() - startDate.getTime() > 7 * 86400000
        ) {
            errors.push(
                `Row ${number}: use valid Athens times in YYYY-MM-DDTHH:mm format; end must follow start within seven days. Ambiguous or nonexistent clock-change times are not supported.`,
            );
            return;
        }
        const key = JSON.stringify([reason, role, start, end]);
        if (seen.has(key)) {
            errors.push(`Row ${number}: duplicate call-out in this file.`);
            return;
        }
        seen.add(key);
        entries.push({
            reason,
            role: role as Role,
            start,
            end,
            dutyDate: dutyDate(startDate, role),
            duration: callOutDuration(startDate, endDate),
        });
    });
    return { entries: errors.length ? [] : entries, errors };
}
