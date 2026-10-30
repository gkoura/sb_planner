"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { announcements } from "@/lib/announcements";
import { getCurrentSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function dismissAnnouncement(form: FormData) {
    const session = await getCurrentSession();
    if (!session) redirect("/sign-in");

    const announcement = announcements.find(
        (item) => item.id === form.get("announcementId"),
    );
    if (!announcement) throw new Error("Unknown announcement.");

    await prisma.announcementDismissal.createMany({
        data: { userId: session.user.id, announcementId: announcement.id },
        skipDuplicates: true,
    });
    revalidatePath("/", "layout");
    if (form.get("open") === "1") redirect(announcement.href);
}
