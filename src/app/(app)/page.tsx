import {
  ArrowRight,
  CalendarCheck2,
  Clock3,
  CalendarDays,
  ClipboardList,
  Phone,
  UsersRound,
} from "lucide-react";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

function formatMonth(year: number, month: number) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function getTodayInAthens() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Athens",
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function formatToday(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function daysFromToday(date: string, today: string) {
  return Math.round(
    (new Date(`${date}T00:00:00Z`).getTime() -
      new Date(`${today}T00:00:00Z`).getTime()) /
      86_400_000,
  );
}

function TodayStandbyCard({
  assignment,
  today,
}: {
  assignment: {
    nameSnapshot: string;
    phoneNumber: string | null;
    planningMonth: { id: string };
  } | null;
  today: string;
}) {
  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:py-6">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Clock3 aria-hidden="true" className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              On standby today · {formatToday(today)}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {assignment?.nameSnapshot ?? "No published standby assignment"}
            </h2>
          </div>
        </div>
        {assignment ? (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {assignment.phoneNumber ? (
              <Button
                nativeButton={false}
                render={<a href={`tel:${assignment.phoneNumber}`} />}
                variant="outline"
              >
                <Phone aria-hidden="true" />
                {assignment.phoneNumber}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                No phone number on file
              </p>
            )}
            <Button
              nativeButton={false}
              render={
                <Link href={`/schedules/${assignment.planningMonth.id}`} />
              }
              variant="outline"
            >
              View schedule <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The team schedule for today hasn’t been published.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type HomepageSchedule = {
  id: string;
  year: number;
  month: number;
  members: {
    id: string;
    userId: string;
    nameSnapshot: string;
    roleSnapshot: string;
  }[];
  scheduleRuns: {
    version: number;
    assignments: {
      date: string;
      planningMemberId: string;
      nameSnapshot: string;
      roleSnapshot: string;
      planningMember: { user: { phoneNumber: string | null } };
      shadows: {
        shadowMemberId: string;
        kind: "TRAINING" | "MENTORING";
        nameSnapshot: string;
      }[];
    }[];
  }[];
};

function PersonalMonthReport({
  schedule,
  userId,
  today,
}: {
  schedule: HomepageSchedule | null;
  userId: string;
  today: string;
}) {
  const member = schedule?.members.find(
    (candidate) => candidate.userId === userId,
  );
  const assignments = (schedule?.scheduleRuns[0].assignments ?? []).flatMap(
    (assignment) => {
      if (assignment.planningMemberId === member?.id) {
        return [{ date: assignment.date, duty: "Primary standby" }];
      }
      const shadow = assignment.shadows.find(
        (candidate) => candidate.shadowMemberId === member?.id,
      );
      if (!shadow) return [];
      return [
        {
          date: assignment.date,
          duty:
            shadow.kind === "TRAINING"
              ? `Shadowing ${assignment.nameSnapshot}`
              : `Mentoring ${assignment.nameSnapshot}`,
        },
      ];
    },
  );
  const nextAssignment = assignments.find(
    (assignment) => assignment.date >= today,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Your standby days this month</CardTitle>
          <CardDescription className="mt-1">
            {schedule
              ? `${formatMonth(schedule.year, schedule.month)} · ${assignments.length} standby ${assignments.length === 1 ? "day" : "days"}`
              : "Your shifts will appear here after this month’s schedule is published."}
          </CardDescription>
        </div>
        {schedule ? (
          <Button
            nativeButton={false}
            render={<Link href={`/schedules/${schedule.id}`} />}
            variant="outline"
          >
            Full schedule <ArrowRight aria-hidden="true" />
          </Button>
        ) : null}
      </CardHeader>
      {schedule ? (
        <CardContent className="grid gap-5">
          {nextAssignment ? (
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
              <p className="text-sm font-medium text-primary">
                {daysFromToday(nextAssignment.date, today) === 0
                  ? "You’re on standby today"
                  : "Your next standby day"}
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">
                {formatToday(nextAssignment.date)}
              </p>
              {daysFromToday(nextAssignment.date, today) > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  In {daysFromToday(nextAssignment.date, today)}{" "}
                  {daysFromToday(nextAssignment.date, today) === 1
                    ? "day"
                    : "days"}
                </p>
              ) : null}
            </div>
          ) : assignments.length ? (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              You have no more standby days this month.
            </p>
          ) : (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              You have no standby days assigned this month.
            </p>
          )}

          {assignments.length ? (
            <ul
              aria-label="Your standby days this month"
              className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            >
              {assignments.map((assignment) => {
                const isNext = assignment.date === nextAssignment?.date;
                return (
                  <li
                    className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${isNext ? "border-primary/40 bg-primary/5" : "bg-background"}`}
                    key={assignment.date}
                  >
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium">
                        {formatToday(assignment.date)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {assignment.duty}
                      </span>
                    </span>
                    {isNext ? (
                      <Badge variant="secondary">
                        {assignment.date === today ? "Today" : "Next up"}
                      </Badge>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

function HomeFallback() {
  return (
    <div
      aria-label="Loading planning overview"
      className="grid gap-8"
      role="status"
    >
      <section className="rounded-3xl bg-primary px-6 py-8 text-primary-foreground shadow-sm sm:px-9 sm:py-10">
        <p className="text-sm font-medium text-primary-foreground/80">
          SB Planner
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Your standby desk
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
          Loading your planning overview…
        </p>
      </section>
      <section aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const today = getTodayInAthens();
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7));
  const publishedMonth = await prisma.planningMonth.findFirst({
    where: {
      year: todayYear,
      month: todayMonth,
      status: "PUBLISHED",
    },
    include: {
      members: {
        orderBy: { nameSnapshot: "asc" },
        select: {
          id: true,
          userId: true,
          nameSnapshot: true,
          roleSnapshot: true,
        },
      },
      scheduleRuns: {
        where: { publishedAt: { not: null } },
        orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
        take: 1,
        include: {
          assignments: {
            orderBy: { date: "asc" },
            include: {
              shadows: {
                select: {
                  shadowMemberId: true,
                  kind: true,
                  nameSnapshot: true,
                },
              },
              planningMember: {
                select: { user: { select: { phoneNumber: true } } },
              },
            },
          },
        },
      },
    },
  });
  const currentRun = publishedMonth?.scheduleRuns[0];
  const todayAssignment = currentRun?.assignments.find(
    (assignment) => assignment.date === today,
  );
  const onCallToday =
    todayAssignment && publishedMonth
      ? {
          nameSnapshot: todayAssignment.nameSnapshot,
          phoneNumber: todayAssignment.planningMember.user.phoneNumber,
          planningMonth: { id: publishedMonth.id },
        }
      : null;
  const homepageSchedule =
    currentRun && publishedMonth
      ? { ...publishedMonth, scheduleRuns: [currentRun] }
      : null;

  if (session.user.role === "ADMIN") {
    const [months, engineerCount] = await Promise.all([
      prisma.planningMonth.findMany({
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 3,
        include: {
          members: {
            select: { availabilitySubmission: { select: { id: true } } },
          },
        },
      }),
      prisma.user.count({ where: { role: "ENGINEER" } }),
    ]);
    return (
      <div className="grid gap-8">
        <TodayStandbyCard assignment={onCallToday} today={today} />
        <PersonalMonthReport
          schedule={homepageSchedule}
          today={today}
          userId={session.user.id}
        />
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
            Your standby desk, {session.user.name.split(" ")[0]}.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
            Keep the monthly rotation clear, balanced, and ready for the whole
            team.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              className="bg-background text-foreground hover:bg-background/90"
              nativeButton={false}
              render={<Link href="/admin/months" />}
            >
              Manage planning months
              <ArrowRight aria-hidden="true" />
            </Button>
            <Button
              className="border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/15"
              nativeButton={false}
              render={<Link href="/admin/users" />}
              variant="outline"
            >
              Manage team
            </Button>
          </div>
        </section>

        <section
          aria-label="Team overview"
          className="grid gap-4 sm:grid-cols-2"
        >
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 py-5">
              <span className="grid size-11 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
                <UsersRound aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-2xl font-semibold tracking-tight">
                  {engineerCount}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">
                    / 10
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Engineer accounts
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 py-5">
              <span className="grid size-11 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
                <ClipboardList aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-2xl font-semibold tracking-tight">
                  {months.length}
                </p>
                <p className="text-sm text-muted-foreground">
                  Recent planning months
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-primary">
                Planning overview
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                Latest months
              </h2>
            </div>
            <Button
              nativeButton={false}
              render={<Link href="/admin/months" />}
              size="sm"
              variant="ghost"
            >
              All months <ArrowRight aria-hidden="true" />
            </Button>
          </div>
          {months.length > 0 ? (
            <div className="grid gap-3">
              {months.map((month) => {
                const submitted = month.members.filter(
                  (member) => member.availabilitySubmission,
                ).length;
                const progress = month.members.length
                  ? Math.round((submitted / month.members.length) * 100)
                  : 0;
                return (
                  <Link
                    className="group rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    href={`/admin/months/${month.id}`}
                    key={month.id}
                  >
                    <Card className="transition-colors group-hover:bg-card/70">
                      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4 sm:py-5">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                            <CalendarDays
                              aria-hidden="true"
                              className="size-5"
                            />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {formatMonth(month.year, month.month)}
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {submitted} of {month.members.length} availability
                              submissions
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            aria-label={`${progress}% submitted`}
                            className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block"
                            role="img"
                          >
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <Badge variant="secondary">
                            {month.status.toLowerCase()}
                          </Badge>
                          <ArrowRight
                            aria-hidden="true"
                            className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed shadow-none">
              <CardHeader>
                <CardTitle>Start with a planning month</CardTitle>
                <CardDescription>
                  Choose participants, open availability, and create your first
                  standby schedule.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  nativeButton={false}
                  render={<Link href="/admin/months" />}
                >
                  Create a planning month <ArrowRight aria-hidden="true" />
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    );
  }

  const memberships = await prisma.planningMember.findMany({
    where: {
      userId: session.user.id,
      planningMonth: { status: { in: ["COLLECTING", "READY"] } },
    },
    include: {
      availabilitySubmission: { select: { submittedAt: true } },
      planningMonth: {
        select: { id: true, month: true, status: true, year: true },
      },
    },
    orderBy: [
      { planningMonth: { year: "desc" } },
      { planningMonth: { month: "desc" } },
    ],
  });
  const availabilityNeeded = memberships.some(
    (membership) => !membership.availabilitySubmission,
  );

  return (
    <div className="grid gap-8">
      <TodayStandbyCard assignment={onCallToday} today={today} />
      <PersonalMonthReport
        schedule={homepageSchedule}
        today={today}
        userId={session.user.id}
      />
      <section className="relative isolate overflow-hidden rounded-3xl bg-primary px-6 py-8 text-primary-foreground shadow-sm sm:px-9 sm:py-10">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-28 -z-10 size-80 rounded-full border-36 border-primary-foreground/10"
        />
        <Badge
          className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground"
          variant="outline"
        >
          <CalendarCheck2 aria-hidden="true" />
          Your standby rotation
        </Badge>
        <h1 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Hi, {session.user.name.split(" ")[0]}.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
          Keep your dates up to date so your team can build a balanced schedule.
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

      <section className="grid gap-4">
        <div>
          <p className="text-sm font-medium text-primary">
            Your planning months
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            Availability status
          </h2>
        </div>
        {memberships.length > 0 ? (
          <div className="grid gap-3">
            {memberships.map((membership) => (
              <Card key={membership.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4 sm:py-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                      <CalendarDays aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <p className="font-semibold">
                        {formatMonth(
                          membership.planningMonth.year,
                          membership.planningMonth.month,
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {membership.availabilitySubmission
                          ? "Your availability is on file"
                          : "Your availability is needed"}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      membership.availabilitySubmission
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {membership.availabilitySubmission
                      ? "Submitted"
                      : "Action needed"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed shadow-none">
            <CardHeader>
              <CardTitle>No open availability yet</CardTitle>
              <CardDescription>
                When you are added to a month, it will appear here for you to
                submit your dates.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>
    </div>
  );
}
