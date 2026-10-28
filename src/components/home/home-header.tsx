import { ArrowRight, CalendarCheck2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function HomeHeader({
  name,
  availabilityNeeded,
}: {
  name: string;
  availabilityNeeded: boolean;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-primary px-6 py-8 text-primary-foreground shadow-sm sm:px-9 sm:py-10">
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-28 -z-10 size-80 rounded-full border-36 border-primary-foreground/10"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 right-28 -z-10 size-64 rounded-full bg-primary-foreground/5 blur-2xl"
      />
      <Badge
        className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground"
        variant="outline"
      >
        <CalendarCheck2 aria-hidden="true" />
        Team standby
      </Badge>
      <h1 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Your standby desk, {name.split(" ")[0]}.
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
        Keep the monthly rotation clear, balanced, and ready for the whole team.
      </p>
      {availabilityNeeded ? (
        <Button
          className="mt-6 bg-background text-foreground hover:bg-background/90"
          nativeButton={false}
          render={<Link href="/availability" />}
        >
          Submit availability <ArrowRight aria-hidden="true" />
        </Button>
      ) : null}
    </section>
  );
}
