import { redirect } from "next/navigation";
import { type ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { getCurrentSession } from "@/lib/auth-guard";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-muted/25">
      <AppHeader name={session.user.name} role={session.user.role} />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
