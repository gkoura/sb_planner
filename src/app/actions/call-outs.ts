"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth-guard";
import { dutyDate, parseAthensDateTime } from "@/lib/call-outs";
import { prisma } from "@/lib/prisma";
import { CallOutRole } from "@prisma/client";

export async function createCallOut(form: FormData) {
    const session = await getCurrentSession();
    if (!session) redirect("/sign-in");
    const submissionId = String(form.get("submissionId") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    const role = String(form.get("role") ?? "");
    const start = parseAthensDateTime(String(form.get("start") ?? ""));
    const end = parseAthensDateTime(String(form.get("end") ?? ""));
    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            submissionId,
        ) ||
        !reason ||
        reason.length > 2000 ||
        !Object.values(CallOutRole).includes(role as CallOutRole) ||
        !start ||
        !end ||
        end <= start ||
        end.getTime() - start.getTime() > 7 * 86400000
    ) {
        redirect("/call-outs?error=invalid");
    }
    await prisma.callOut.createMany({
        skipDuplicates: true,
        data: {
            id: submissionId,
            userId: session.user.id,
            reason,
            role: role as CallOutRole,
            dutyDate: dutyDate(start),
            startedAt: start,
            endedAt: end,
        },
    });
    const saved = await prisma.callOut.findFirst({
        where: { id: submissionId, userId: session.user.id },
        select: { id: true },
    });
    if (!saved) throw new Error("Unable to save call-out.");
    revalidatePath("/call-outs");
    redirect("/call-outs?saved=1");
}

export async function deleteCallOut(form: FormData) {
    const session = await getCurrentSession();
    if (!session) redirect("/sign-in");
    await prisma.callOut.deleteMany({
        where: { id: String(form.get("id") ?? ""), userId: session.user.id },
    });
    revalidatePath("/call-outs");
}
