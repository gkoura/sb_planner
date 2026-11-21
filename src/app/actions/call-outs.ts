"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth-guard";
import { dutyDate, parseAthensDateTime } from "@/lib/call-outs";
import { prisma } from "@/lib/prisma";
import { CallOutRole } from "@prisma/client";
import { validateCallOutDuties } from "@/lib/call-out-duty";

function parseCallOut(form: FormData) {
    const reason = String(form.get("reason") ?? "").trim();
    const role = String(form.get("role") ?? "");
    const start = parseAthensDateTime(String(form.get("start") ?? ""));
    const end = parseAthensDateTime(String(form.get("end") ?? ""));
    if (
        !reason ||
        reason.length > 2000 ||
        !Object.values(CallOutRole).includes(role as CallOutRole) ||
        !start ||
        !end ||
        end <= start ||
        end.getTime() - start.getTime() > 7 * 86400000
    )
        return null;
    return {
        reason,
        role: role as CallOutRole,
        dutyDate: dutyDate(start, role),
        startedAt: start,
        endedAt: end,
    };
}

const invalidCallOut =
    "Check the reason, role and times. End must be after start, within seven days. Times during a daylight-saving clock change may be ambiguous or unavailable.";

export type EditCallOutState = { error?: string };

export async function updateCallOut(
    _state: EditCallOutState,
    form: FormData,
): Promise<EditCallOutState> {
    const session = await getCurrentSession();
    if (!session) redirect("/sign-in");
    const values = parseCallOut(form);
    if (!values)
        return {
            error: invalidCallOut,
        };
    const existing = await prisma.callOut.findFirst({
        where: { id: String(form.get("id") ?? ""), userId: session.user.id },
        select: { id: true },
    });
    if (!existing)
        return {
            error: "This call-out could not be found. It may have been deleted.",
        };
    const errors = await validateCallOutDuties(session.user.id, [values]);
    if (errors.length) return { error: errors[0] };
    const result = await prisma.callOut.updateMany({
        where: { id: String(form.get("id") ?? ""), userId: session.user.id },
        data: values,
    });
    if (!result.count)
        return {
            error: "This call-out could not be found. It may have been deleted.",
        };
    revalidatePath("/call-outs");
    redirect("/call-outs?saved=1");
}

export async function createCallOut(
    _state: { error?: string },
    form: FormData,
): Promise<{ error?: string }> {
    const session = await getCurrentSession();
    if (!session) redirect("/sign-in");
    const submissionId = String(form.get("submissionId") ?? "");
    const values = parseCallOut(form);
    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            submissionId,
        ) ||
        !values
    ) {
        return { error: invalidCallOut };
    }
    const errors = await validateCallOutDuties(session.user.id, [values]);
    if (errors.length) return { error: errors[0] };
    await prisma.callOut.createMany({
        skipDuplicates: true,
        data: {
            id: submissionId,
            userId: session.user.id,
            ...values,
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
