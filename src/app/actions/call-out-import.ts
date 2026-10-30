"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth-guard";
import { parseAthensDateTime } from "@/lib/call-outs";
import { validateCallOutImport } from "@/lib/call-out-import";
import { prisma } from "@/lib/prisma";
import { validateCallOutDuties } from "@/lib/call-out-duty";

export async function previewCallOutImport(csv: string) {
    const session = await getCurrentSession();
    if (!session) return { errors: ["Please sign in again."], entries: [] };
    if (typeof csv !== "string")
        return { errors: ["Invalid CSV file."], entries: [] };
    const result = validateCallOutImport(csv);
    if (result.errors.length) return result;
    const errors = await validateCallOutDuties(
        session.user.id,
        result.entries.map((entry) => ({
            role: entry.role,
            startedAt: parseAthensDateTime(entry.start)!,
        })),
    );
    return { entries: errors.length ? [] : result.entries, errors };
}

export async function importCallOuts(
    csv: string,
): Promise<{ error: string } | { imported: number; skipped: number }> {
    const session = await getCurrentSession();
    if (!session) return { error: "Please sign in again." };
    if (typeof csv !== "string") return { error: "Invalid CSV file." };
    const { entries, errors } = validateCallOutImport(csv);
    if (errors.length) return { error: errors.join(" ") };
    const dutyErrors = await validateCallOutDuties(
        session.user.id,
        entries.map((entry) => ({
            role: entry.role,
            startedAt: parseAthensDateTime(entry.start)!,
        })),
    );
    if (dutyErrors.length) return { error: dutyErrors.join(" ") };
    const data = entries.map((entry) => ({
        id: `import-${createHash("sha256")
            .update(
                JSON.stringify([
                    session.user.id,
                    entry.reason,
                    entry.role,
                    entry.start,
                    entry.end,
                ]),
            )
            .digest("hex")}`,
        userId: session.user.id,
        reason: entry.reason,
        role: entry.role,
        dutyDate: entry.dutyDate,
        startedAt: parseAthensDateTime(entry.start)!,
        endedAt: parseAthensDateTime(entry.end)!,
    }));
    const existing = await prisma.callOut.findMany({
        where: {
            userId: session.user.id,
            startedAt: { in: data.map((entry) => entry.startedAt) },
        },
        select: { reason: true, role: true, startedAt: true, endedAt: true },
    });
    const keys = new Set(
        existing.map((entry) =>
            JSON.stringify([
                entry.reason,
                entry.role,
                entry.startedAt.toISOString(),
                entry.endedAt.toISOString(),
            ]),
        ),
    );
    const fresh = data.filter(
        (entry) =>
            !keys.has(
                JSON.stringify([
                    entry.reason,
                    entry.role,
                    entry.startedAt.toISOString(),
                    entry.endedAt.toISOString(),
                ]),
            ),
    );
    // An imported record may have been edited while retaining its original ID.
    // Find a free deterministic ID for the original data before inserting it again.
    let candidates = fresh.map((entry) => ({
        entry,
        baseId: entry.id,
        suffix: 0,
    }));
    while (candidates.length) {
        const occupied = await prisma.callOut.findMany({
            where: { id: { in: candidates.map(({ entry }) => entry.id) } },
            select: {
                id: true,
                userId: true,
                reason: true,
                role: true,
                startedAt: true,
                endedAt: true,
            },
        });
        const byId = new Map(occupied.map((entry) => [entry.id, entry]));
        candidates = candidates.filter(({ entry }) => byId.has(entry.id));
        for (const candidate of candidates) {
            const existingEntry = byId.get(candidate.entry.id)!;
            if (
                existingEntry.userId === candidate.entry.userId &&
                existingEntry.reason === candidate.entry.reason &&
                existingEntry.role === candidate.entry.role &&
                existingEntry.startedAt.getTime() ===
                    candidate.entry.startedAt.getTime() &&
                existingEntry.endedAt.getTime() ===
                    candidate.entry.endedAt.getTime()
            ) {
                fresh.splice(fresh.indexOf(candidate.entry), 1);
            } else {
                candidate.suffix += 1;
                candidate.entry.id = `${candidate.baseId}-${candidate.suffix}`;
            }
        }
        candidates = candidates.filter(({ entry }) => fresh.includes(entry));
    }
    const result = fresh.length
        ? await prisma.callOut.createMany({ data: fresh, skipDuplicates: true })
        : { count: 0 };
    revalidatePath("/call-outs");
    return { imported: result.count, skipped: entries.length - result.count };
}
