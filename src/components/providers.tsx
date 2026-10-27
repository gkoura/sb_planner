"use client";

import { AuthProvider } from "@/components/auth/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider
        authClient={authClient}
        basePaths={{ auth: "" }}
        emailAndPassword={{
          enabled: true,
          forgotPassword: false,
          requireEmailVerification: false,
        }}
        Link={Link}
        navigate={({ replace, to }) =>
          replace ? router.replace(to) : router.push(to)
        }
        queryClient={queryClient}
        redirectTo="/"
      >
        {children}
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
