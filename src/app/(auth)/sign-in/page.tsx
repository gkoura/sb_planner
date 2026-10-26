import { CalendarDays, ShieldCheck } from "lucide-react";

import { SignIn } from "@/components/auth/sign-in";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SignInPage() {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-4 sm:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 size-96 rounded-full bg-secondary/70 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -right-32 size-128 rounded-full bg-accent/70 blur-3xl"
      />
      <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>
      <div className="relative grid w-full max-w-md gap-6">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <CalendarDays aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            SB Planner
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome to your standby desk
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to share availability and review your team&apos;s schedule.
          </p>
        </div>
        <SignIn allowSignUp={false} />
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="size-3.5" />
          Private workspace for your engineering team
        </p>
      </div>
    </main>
  );
}
