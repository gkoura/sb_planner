
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { getCurrentSession } from "@/lib/auth-guard";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <Suspense fallback={<AppLayoutFallback />}>
      <AuthenticatedAppLayout>
        {children}
      </AuthenticatedAppLayout>
    </Suspense>
  );
}

async function AuthenticatedAppLayout({
  children,
}: AppLayoutProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        name={session.user.name}
        role={session.user.role}
      />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}

function AppLayoutFallback() {
  return (
    <div
      className="min-h-screen bg-background"
      role="status"
      aria-label="Loading standby workspace"
    >
      <header className="border-b border-border/80 bg-background">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm"
          >
            SB
          </span>

          <span className="font-semibold tracking-tight">
            SB Planner
          </span>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <p className="text-sm text-muted-foreground">
          Loading your standby workspace…
        </p>

        <div
          aria-hidden="true"
          className="h-48 animate-pulse rounded-3xl bg-muted"
        />
      </main>
    </div>
  );
}
