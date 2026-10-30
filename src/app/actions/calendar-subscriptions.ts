"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export type CalendarSubscriptionState = {
    error?: string;
    url?: string;
    message?: string;
};

export async function manageCalendarSubscription(
    _state: CalendarSubscriptionState,
    formData: FormData,
): Promise<CalendarSubscriptionState> {
    const session = await getCurrentSession();
    if (!session) return { error: "Please sign in again." };
    const type = formData.get("type");
    const action = formData.get("action");
    if (
        (type !== "ALL" && type !== "PERSONAL") ||
        (action !== "generate" && action !== "revoke")
    )
        return { error: "Invalid subscription request." };
    if (action === "revoke") {
        await prisma.calendarSubscription.deleteMany({
            where: { userId: session.user.id, type },
        });
        revalidatePath("/schedules");
        return {
            message:
                "Link revoked. Existing subscriptions can no longer refresh.",
        };
    }
    let origin: URL;
    try {
        origin = new URL(process.env.BETTER_AUTH_URL ?? "");
        if (
            origin.protocol !== "https:" &&
            !(
                origin.protocol === "http:" &&
                ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
            )
        )
            throw new Error();
    } catch {
        return {
            error: "The public app URL is not configured. Contact an administrator.",
        };
    }
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.calendarSubscription.upsert({
        where: { userId_type: { userId: session.user.id, type } },
        create: { userId: session.user.id, type, tokenHash },
        update: { tokenHash },
    });
    revalidatePath("/schedules");
    return {
        url: new URL(`/api/calendar/${token}`, origin).toString(),
        message: "Copy or subscribe now. This link will not be shown again.",
    };
}
