import Link from "next/link";
import {
    CalendarDays,
    LogOut,
    Settings,
    Shield,
    UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

type AppHeaderProps = {
    name: string;
    role: string;
};

export function AppHeader({ name, role }: AppHeaderProps) {
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
                        className="hidden items-center gap-1 md:flex"
                    >
                        <Button
                            nativeButton={false}
                            render={<Link href="/availability" />}
                            size="sm"
                            variant="ghost"
                        >
                            Availability
                        </Button>
                        <Button
                            nativeButton={false}
                            render={<Link href="/schedules" />}
                            size="sm"
                            variant="ghost"
                        >
                            Schedules
                        </Button>
                        <Button
                            nativeButton={false}
                            render={<Link href="/call-outs" />}
                            size="sm"
                            variant="ghost"
                        >
                            Call-outs
                        </Button>
                        <Button
                            nativeButton={false}
                            render={<Link href="/account" />}
                            size="sm"
                            variant="ghost"
                        >
                            <Settings aria-hidden="true" />
                            Account
                        </Button>
                        {role === "ADMIN" ? (
                            <>
                                <Button
                                    nativeButton={false}
                                    render={<Link href="/admin/months" />}
                                    size="sm"
                                    variant="ghost"
                                >
                                    Planning months
                                </Button>
                                <Button
                                    nativeButton={false}
                                    render={<Link href="/admin/users" />}
                                    size="sm"
                                    variant="ghost"
                                >
                                    Team
                                </Button>
                            </>
                        ) : null}
                    </nav>

                    <div className="flex items-center gap-2">
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
                                <span className="max-w-36 truncate text-xs font-semibold">
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
                            className="h-10 sm:h-7"
                            nativeButton={false}
                            render={<Link href="/sign-out" />}
                            size="sm"
                            variant="ghost"
                        >
                            <LogOut aria-hidden="true" />
                            <span className="hidden sm:inline">Sign out</span>
                        </Button>
                    </div>
                </div>
                <nav
                    aria-label="Mobile navigation"
                    className="flex min-h-12 items-center gap-1 border-t md:hidden"
                >
                    <Button
                        className="h-11 flex-1"
                        nativeButton={false}
                        render={<Link href="/availability" />}
                        size="sm"
                        variant="ghost"
                    >
                        Availability
                    </Button>
                    <Button
                        className="h-11 flex-1"
                        nativeButton={false}
                        render={<Link href="/schedules" />}
                        size="sm"
                        variant="ghost"
                    >
                        Schedules
                    </Button>
                    <Button
                        className="h-11 flex-1"
                        nativeButton={false}
                        render={<Link href="/call-outs" />}
                        size="sm"
                        variant="ghost"
                    >
                        Call-outs
                    </Button>
                    <Button
                        aria-label="Account settings"
                        className="h-11 flex-1"
                        nativeButton={false}
                        render={<Link href="/account" />}
                        size="sm"
                        variant="ghost"
                    >
                        <Settings aria-hidden="true" />
                        <span className="hidden sm:inline">Account</span>
                    </Button>
                    {role === "ADMIN" ? (
                        <>
                            <Button
                                className="h-11 flex-1"
                                nativeButton={false}
                                render={<Link href="/admin/months" />}
                                size="sm"
                                variant="ghost"
                            >
                                Months
                            </Button>
                            <Button
                                className="h-11 flex-1"
                                nativeButton={false}
                                render={<Link href="/admin/users" />}
                                size="sm"
                                variant="ghost"
                            >
                                Team
                            </Button>
                        </>
                    ) : null}
                </nav>
            </div>
        </header>
    );
}
