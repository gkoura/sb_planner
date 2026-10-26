import Link from "next/link";
import { CalendarDays, LogOut, Shield, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AppHeaderProps = {
  name: string;
  role: string;
};

export function AppHeader({ name, role }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-3">
          <Link className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" href="/">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <CalendarDays aria-hidden="true" className="size-5" />
            </span>
            <span className="grid leading-none">
              <span className="font-semibold tracking-tight">SB Planner</span>
              <span className="mt-1 hidden text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:block">
                Standby desk
              </span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            <Button render={<Link href="/availability" />} size="sm" variant="ghost">
              Availability
            </Button>
            <Button render={<Link href="/schedules" />} size="sm" variant="ghost">
              Schedules
            </Button>
            {role === "ADMIN" ? (
              <>
                <Button render={<Link href="/admin/months" />} size="sm" variant="ghost">
                  Planning months
                </Button>
                <Button render={<Link href="/admin/users" />} size="sm" variant="ghost">
                  Team
                </Button>
              </>
            ) : null}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 lg:flex">
              <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-secondary text-secondary-foreground">
                {role === "ADMIN" ? <Shield className="size-3.5" /> : <UsersRound className="size-3.5" />}
              </span>
              <span className="grid leading-tight">
                <span className="max-w-36 truncate text-xs font-semibold">{name}</span>
                <Badge className="w-fit px-0 text-[0.6rem] uppercase tracking-wider" variant="ghost">
                  {role.toLowerCase()}
                </Badge>
              </span>
            </div>
            <Button className="h-10 sm:h-7" render={<Link href="/sign-out" />} size="sm" variant="ghost">
              <LogOut aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        <nav aria-label="Mobile navigation" className="flex min-h-12 items-center gap-1 border-t md:hidden">
          <Button className="h-11 flex-1" render={<Link href="/availability" />} size="sm" variant="ghost">
            Availability
          </Button>
          <Button className="h-11 flex-1" render={<Link href="/schedules" />} size="sm" variant="ghost">
            Schedules
          </Button>
          {role === "ADMIN" ? (
            <>
              <Button className="h-11 flex-1" render={<Link href="/admin/months" />} size="sm" variant="ghost">
                Months
              </Button>
              <Button className="h-11 flex-1" render={<Link href="/admin/users" />} size="sm" variant="ghost">
                Team
              </Button>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
