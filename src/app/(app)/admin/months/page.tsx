import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { OpenCollectionForm } from "@/components/availability/open-collection-form";
import { CreatePlanningMonthForm } from "@/components/planning-months/create-planning-month-form";
import { DeleteDraftMonthForm } from "@/components/planning-months/delete-draft-month-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

function formatMonth(year: number, month: number) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default function PlanningMonthsPage() {
  return (
    <div className="grid gap-8">
      <section className="grid gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="size-5" />
          <span className="text-sm font-medium">Planning setup</span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight">
          Planning months
        </h1>

        <p className="text-muted-foreground">
          Choose who will participate in each month. Membership is saved as a
          snapshot, and you can opt into a month without using an engineer slot.
        </p>

        <p className="text-sm text-muted-foreground">
          Only draft months without schedule history can be deleted; submitted
          availability and published schedules remain in history.
        </p>
      </section>

      <Suspense fallback={<PlanningMonthsFallback />}>
        <PlanningMonthsContent />
      </Suspense>
    </div>
  );
}

function PlanningMonthsFallback() {
  return (
    <div
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
      role="status"
      aria-label="Loading planning months"
    >
      <section className="grid gap-4">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-48 animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </section>

      <div
        aria-hidden="true"
        className="h-72 animate-pulse rounded-2xl bg-muted"
      />
    </div>
  );
}

async function PlanningMonthsContent() {
  const session = await requireAdmin();

  const [months, engineers] = await Promise.all([
    prisma.planningMonth.findMany({
      include: {
        members: {
          orderBy: { nameSnapshot: "asc" },
          select: {
            availabilitySubmission: {
              select: { id: true },
            },
            emailSnapshot: true,
            id: true,
            nameSnapshot: true,
            roleSnapshot: true,
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),

    prisma.user.findMany({
      where: { role: "ENGINEER" },
      orderBy: { name: "asc" },
      select: {
        email: true,
        id: true,
        name: true,
      },
    }),
  ]);

  const now = new Date();

  const monthValue = `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}`;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Existing planning months" className="grid gap-4">
        {months.length > 0 ? (
          months.map((planningMonth) => (
            <Card key={planningMonth.id}>
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div className="grid gap-1">
                  <CardTitle>
                    {formatMonth(planningMonth.year, planningMonth.month)}
                  </CardTitle>

                  <CardDescription>
                    {planningMonth.members.length} participant
                    {planningMonth.members.length === 1 ? "" : "s"}
                  </CardDescription>
                </div>

                <Badge variant="secondary">
                  {planningMonth.status.toLowerCase()}
                </Badge>
              </CardHeader>

              <CardContent>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                  <p className="text-sm text-muted-foreground">
                    {
                      planningMonth.members.filter(
                        (member) => member.availabilitySubmission,
                      ).length
                    }
                    {" / "}
                    {planningMonth.members.length} submitted
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    {planningMonth.status === "DRAFT" ? (
                      <>
                        <OpenCollectionForm
                          planningMonthId={planningMonth.id}
                        />

                        <DeleteDraftMonthForm
                          monthName={formatMonth(
                            planningMonth.year,
                            planningMonth.month,
                          )}
                          planningMonthId={planningMonth.id}
                        />
                      </>
                    ) : null}

                    <Button
                      nativeButton={false}
                      render={
                        <Link href={`/admin/months/${planningMonth.id}`} />
                      }
                      size="sm"
                      variant="outline"
                    >
                      {planningMonth.status === "GENERATED" ||
                      planningMonth.status === "PUBLISHED"
                        ? "Review schedule"
                        : "Open month"}
                    </Button>
                  </div>
                </div>

                <ul className="grid gap-2 sm:grid-cols-2">
                  {planningMonth.members.map((member) => (
                    <li className="min-w-0" key={member.id}>
                      <p className="truncate text-sm font-medium">
                        {member.nameSnapshot}

                        {member.roleSnapshot === "ADMIN" ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            admin
                          </span>
                        ) : null}
                      </p>

                      <p className="truncate text-xs text-muted-foreground">
                        {member.emailSnapshot}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No planning months yet. Create one to choose the first group of
              participants.
            </CardContent>
          </Card>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Create a month</CardTitle>

          <CardDescription>
            Select engineers and decide whether to join the rotation yourself.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <CreatePlanningMonthForm
            adminName={session.user.name}
            engineers={engineers}
            monthValue={monthValue}
          />
        </CardContent>
      </Card>
    </div>
  );
}
