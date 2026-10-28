"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth-guard";
import { parseOptionalPhoneNumber } from "@/lib/phone-number";
import { prisma } from "@/lib/prisma";

export type AccountProfileState = {
    status: "idle" | "success" | "error";
    message: string;
};

export async function saveAccountProfile(
    _previousState: AccountProfileState,
    formData: FormData,
): Promise<AccountProfileState> {
    const session = await getCurrentSession();
    if (!session)
        return {
            status: "error",
            message: "Please sign in again to update your account.",
        };

    const name = String(formData.get("name") ?? "").trim();
    const { phoneNumber, valid: validPhone } = parseOptionalPhoneNumber(
        String(formData.get("phoneNumber") ?? ""),
    );

    if (name.length < 2 || name.length > 80) {
        return {
            status: "error",
            message: "Your name must be between 2 and 80 characters.",
        };
    }
    if (!validPhone) {
        return {
            status: "error",
            message:
                "Enter an international number, including the country code (for example, +306912345678).",
        };
    }

    await prisma.user.update({
        where: { id: session.user.id },
        data: { name, phoneNumber: phoneNumber || null },
    });

    revalidatePath("/");
    revalidatePath("/account");
    revalidatePath("/schedules");
    return { status: "success", message: "Your profile has been updated." };
}
