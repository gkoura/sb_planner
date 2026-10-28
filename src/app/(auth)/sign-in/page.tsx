import { CalendarDays, ShieldCheck } from "lucide-react";

import { SignIn } from "@/components/auth/sign-in";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SignInPage() {
    return (
        <main className="bg-background relative flex min-h-svh items-center justify-center overflow-hidden p-4 sm:p-8">
            <div
                aria-hidden="true"
                className="bg-secondary/70 pointer-events-none absolute -top-40 -left-40 size-96 rounded-full blur-3xl"
            />
            <div
                aria-hidden="true"
                className="bg-accent/70 pointer-events-none absolute -right-32 -bottom-48 size-128 rounded-full blur-3xl"
            />
            <div className="absolute top-4 right-4 sm:top-8 sm:right-8">
                <ThemeToggle />
            </div>
            <div className="relative grid w-full max-w-md gap-6">
                <div className="text-center">
                    <span className="bg-primary text-primary-foreground mx-auto grid size-12 place-items-center rounded-2xl shadow-sm">
                        <CalendarDays aria-hidden="true" className="size-6" />
                    </span>
                    <p className="text-primary mt-4 text-xs font-semibold tracking-[0.18em] uppercase">
                        SB Planner
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                        Welcome to your standby desk
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Sign in to share availability and review your
                        team&apos;s schedule.
                    </p>
                </div>
                <SignIn allowSignUp={false} />
                <p className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
                    <ShieldCheck aria-hidden="true" className="size-3.5" />
                    Private workspace for your engineering team
                </p>
            </div>
        </main>
    );
}
