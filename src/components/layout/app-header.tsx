import Link from "next/link";
import { CalendarDays, LogOut, Shield, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { ThemeToggle } from "@/components/theme-toggle";

type AppHeaderProps = {
    name: string;
    role: string;
};

export function AppHeader({ name, role }: AppHeaderProps) {
    const links = [
        { href: "/availability", label: "Availability" },
        { href: "/schedules", label: "Schedules" },
        { href: "/call-outs", label: "Call-outs" },
        { href: "/account", label: "Account" },
        ...(role === "ADMIN"
            ? [
                  { href: "/admin/months", label: "Planning months" },
                  { href: "/admin/users", label: "Team" },
              ]
            : []),
    ];
    return (
        <header className="border-border/80 bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="flex min-h-16 items-center justify-between gap-3">
                    <Link
                        className="focus-visible:outline-ring flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4"
                        href="/"
                    >
                        <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-xl shadow-sm">
                            <CalendarDays
                                aria-hidden="true"
                                className="size-5"
                            />
                        </span>
                        <span className="grid leading-none">
                            <span className="font-semibold tracking-tight">
                                SB Planner
                            </span>
                            <span className="text-muted-foreground mt-1 hidden text-[0.65rem] font-medium tracking-[0.16em] uppercase sm:block">
                                Standby desk
                            </span>
                        </span>
                    </Link>

                    <nav
                        aria-label="Main navigation"
                        className="hidden items-center gap-1 xl:flex"
                    >
                        {links.map((link) => (
                            <Button
                                key={link.href}
                                nativeButton={false}
                                render={<Link href={link.href} />}
                                size="sm"
                                variant="ghost"
                            >
                                {link.label}
                            </Button>
                        ))}
                    </nav>

                    <div className="flex shrink-0 items-center gap-2">
                        <MobileNavigation
                            links={[
                                ...links,
                                { href: "/sign-out", label: "Sign out" },
                            ]}
                        />
                        <ThemeToggle />
                        <div className="bg-card hidden items-center gap-2 rounded-full border px-3 py-1.5 lg:flex">
                            <span
                                aria-hidden="true"
                                className="bg-secondary text-secondary-foreground grid size-7 place-items-center rounded-full"
                            >
                                {role === "ADMIN" ? (
                                    <Shield className="size-3.5" />
                                ) : (
                                    <UsersRound className="size-3.5" />
                                )}
                            </span>
                            <span className="grid leading-tight">
                                <span className="max-w-20 truncate text-xs font-semibold">
                                    {name}
                                </span>
                                <Badge
                                    className="w-fit px-0 text-[0.6rem] tracking-wider uppercase"
                                    variant="ghost"
                                >
                                    {role.toLowerCase()}
                                </Badge>
                            </span>
                        </div>
                        <Button
                            className="hidden sm:inline-flex"
                            nativeButton={false}
                            render={<Link href="/sign-out" />}
                            size="sm"
                            variant="ghost"
                        >
                            <LogOut aria-hidden="true" />
                            <span className="sr-only sm:not-sr-only">
                                Sign out
                            </span>
                        </Button>
                    </div>
                </div>
                <nav
                    aria-label="Main navigation"
                    className="hidden flex-wrap items-center gap-1 border-t py-2 sm:flex xl:hidden"
                >
                    {links.map((link) => (
                        <Button
                            key={link.href}
                            nativeButton={false}
                            render={<Link href={link.href} />}
                            size="sm"
                            variant="ghost"
                        >
                            {link.label}
                        </Button>
                    ))}
                </nav>
            </div>
        </header>
    );
}
