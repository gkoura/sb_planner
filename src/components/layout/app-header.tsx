import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AppHeaderProps = {
  name: string;
  role: string;
};

export function AppHeader({ name, role }: AppHeaderProps) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link className="font-semibold tracking-tight" href="/">
          SB Planner
        </Link>
        {role === "ADMIN" ? (
          <nav aria-label="Admin navigation" className="hidden items-center gap-1 sm:flex">
            <Button render={<Link href="/admin/months" />} size="sm" variant="ghost">
              Planning months
            </Button>
            <Button render={<Link href="/admin/users" />} size="sm" variant="ghost">
              Engineers
            </Button>
          </nav>
        ) : null}
        <div className="flex items-center gap-3">
          <div className="hidden text-right text-sm sm:block">
            <p className="font-medium">{name}</p>
            <Badge variant="secondary">{role.toLowerCase()}</Badge>
          </div>
          <Button render={<Link href="/sign-out" />} size="sm" variant="outline">
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
