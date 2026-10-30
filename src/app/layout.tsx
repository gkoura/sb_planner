import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: {
        default: "SB Planner · Standby scheduling",
        template: "%s · SB Planner",
    },
    description:
        "A clear, fair way to plan your team’s monthly standby rotation.",
};

function RootLoadingFallback() {
    return (
        <div className="bg-background min-h-screen">
            <header className="border-border/80 bg-background border-b">
                <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
                    <span
                        aria-hidden="true"
                        className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-xl text-sm font-semibold shadow-sm"
                    >
                        SB
                    </span>
                    <span className="font-semibold tracking-tight">
                        SB Planner
                    </span>
                </div>
            </header>
            <main
                aria-label="Loading standby workspace"
                className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
                role="status"
            >
                <p className="text-muted-foreground text-sm">
                    Loading your standby workspace…
                </p>
                <div
                    aria-hidden="true"
                    className="bg-muted h-48 animate-pulse rounded-3xl"
                />
            </main>
        </div>
    );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
            suppressHydrationWarning
        >
            <body className="flex min-h-full flex-col">
                <Providers>
                    <Suspense fallback={<RootLoadingFallback />}>
                        {children}
                    </Suspense>
                </Providers>
                <Analytics />
            </body>
        </html>
    );
}
