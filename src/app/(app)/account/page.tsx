import { Suspense } from "react";
import { redirect } from "next/navigation";
import { KeyRound, Settings2 } from "lucide-react";

import {
    ChangePasswordForm,
    ProfileSettingsForm,
} from "@/components/account/account-settings-forms";
import { getCurrentSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export default function AccountSettingsPage() {
    return (
        <Suspense fallback={<AccountSettingsFallback />}>
            <AccountSettingsContent />
        </Suspense>
    );
}

function AccountSettingsFallback() {
    return (
        <div
            className="mx-auto grid max-w-3xl gap-8"
            role="status"
            aria-label="Loading account settings"
        >
            <section className="grid gap-3">
                <div className="bg-muted h-5 w-28 animate-pulse rounded" />
                <div className="bg-muted h-9 w-56 animate-pulse rounded" />
                <div className="bg-muted h-5 w-80 max-w-full animate-pulse rounded" />
            </section>

            <div
                aria-hidden="true"
                className="bg-muted h-64 animate-pulse rounded-2xl"
            />

            <div
                aria-hidden="true"
                className="bg-muted h-48 animate-pulse rounded-2xl"
            />
        </div>
    );
}

async function AccountSettingsContent() {
    const session = await getCurrentSession();

    if (!session) {
        redirect("/sign-in");
    }

    const user = await prisma.user.findUnique({
        where: {
            id: session.user.id,
        },
        select: {
            name: true,
            email: true,
            phoneNumber: true,
        },
    });

    if (!user) {
        redirect("/sign-in");
    }

    return (
        <div className="mx-auto grid max-w-3xl gap-8">
            <section className="grid gap-3">
                <div className="text-muted-foreground flex items-center gap-2">
                    <Settings2 aria-hidden="true" className="size-5" />

                    <span className="text-sm font-medium">Your account</span>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight">
                    Account settings
                </h1>

                <p className="text-muted-foreground max-w-2xl">
                    Manage your team profile and sign-in security.
                </p>
            </section>

            <ProfileSettingsForm
                email={user.email}
                name={user.name}
                phoneNumber={user.phoneNumber}
            />

            <ChangePasswordForm />

            <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <KeyRound aria-hidden="true" className="size-3.5" />
                Your profile is visible only to signed-in members of this team.
            </p>
        </div>
    );
}
