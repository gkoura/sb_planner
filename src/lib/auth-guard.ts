import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const getCurrentSession = cache(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;
    // Recheck current account state rather than trusting an older session payload.
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isActive: true, role: true },
    });
    if (!user?.isActive) return null;
    return { ...session, user: { ...session.user, role: user.role } };
});

export async function requireAdmin() {
    const session = await getCurrentSession();

    if (!session) {
        redirect("/sign-in");
    }

    if (session.user.role !== "ADMIN") {
        redirect("/");
    }

    return session;
}
