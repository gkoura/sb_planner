import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { GenerateScheduleForm } from "@/components/schedules/generate-schedule-form";
import { ParticipationSettingsForm } from "@/components/planning-months/participation-settings-form";
import { PublishScheduleForm } from "@/components/schedules/publish-schedule-form";
import { RestoreScheduleForm } from "@/components/schedules/restore-schedule-form";
import { ScheduleEditor } from "@/components/schedules/schedule-editor";
import { ScheduleCalendar } from "@/components/schedules/schedule-calendar";
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
import {
  getOperationalDate,
  parseScheduleInputSnapshot,
  parseScheduleWarnings,
} from "@/lib/schedule-edits";
import { prisma } from "@/lib/prisma";

function formatMonth(year: number, month: number) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

type PlanningMonthPageProps = {
  params: Promise<{ monthId: string }>;
  searchParams: Promise<{ version?: string | string[] }>;
};

export default function PlanningMonthPage(props: PlanningMonthPageProps) {
  return (
    <Suspense fallback={<PlanningMonthFallback />}>
      <PlanningMonthContent {...props} />
    </Suspense>
  );
}

function PlanningMonthFallback() {
  return (
    <div
      className="grid gap-6"
      role="status"
      aria-label="Loading planning month"
    >
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      <div className="h-96 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

async function PlanningMonthContent({
  params,
  searchParams,
}: PlanningMonthPageProps) {
  await requireAdmin();
  const [{ monthId }, query] = await Promise.all([params, searchParams]);
  const requestedVersionId =
    typeof query.version === "string" ? query.version : undefined;
  const month = await prisma.planningMonth.findUnique({
    where: { id: monthId },
    include: {
      members: {
        orderBy: { nameSnapshot: "asc" },
        include: {
          availabilitySubmission: { select: { id: true } },
          user: { select: { phoneNumber: true } },
        },
      },
      scheduleRuns: {
        orderBy: { version: "desc" },
        include: {
          assignments: {
            orderBy: { date: "asc" },
            include: {
              shadows: {
                select: {
                  id: true,
                  shadowMemberId: true,
                  kind: true,
                  nameSnapshot: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!month) notFound();

  const submittedCount = month.members.filter(
    (member) => member.availabilitySubmission,
  ).length;
  const currentScheduleRun = month.scheduleRuns[0];
  const previewRun = requestedVersionId
    ? month.scheduleRuns.find((run) => run.id === requestedVersionId)
    : undefined;
  const isPreview = !!previewRun && previewRun.id !== currentScheduleRun?.id;
  const scheduleRun = isPreview ? previewRun : currentScheduleRun;
  const previewWarnings = scheduleRun
    ? parseScheduleWarnings(scheduleRun.validationWarnings)
    : [];
  const scheduleSnapshot = scheduleRun
    ? parseScheduleInputSnapshot(scheduleRun.inputSnapshot)
    : null;
  const editorMembers =
    scheduleSnapshot?.members.flatMap((snapshotMember) => {
      const member = month.members.find(
        (candidate) => candidate.id === snapshotMember.id,
      );
      return member
        ? [{ ...snapshotMember, roleSnapshot: member.roleSnapshot }]
        : [];
    }) ?? [];
  const canEditParticipation =
    ["DRAFT", "COLLECTING", "READY"].includes(month.status) &&
    month.scheduleRuns.length === 0;
  const maxShadowDays = Math.ceil(
    new Date(Date.UTC(month.year, month.month, 0)).getUTCDate() / 2,
  );

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <Button
          className="w-fit px-0"
          nativeButton={false}
          render={<Link href="/admin/months" />}
          size="sm"
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" />
          Planning months
        </Button>
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="size-5" />
          <span className="text-sm font-medium">Schedule review</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {formatMonth(month.year, month.month)}
          </h1>
          <Badge variant="secondary">{month.status.toLowerCase()}</Badge>
        </div>
        <p className="text-muted-foreground">
          {submittedCount} of {month.members.length} participants submitted
          availability.
        </p>
      </section>

      {canEditParticipation ? (
        <ParticipationSettingsForm
          key={month.updatedAt.toISOString()}
          maxShadowDays={maxShadowDays}
          members={month.members.map((member) => ({
            id: member.id,
            nameSnapshot: member.nameSnapshot,
            participationMode: member.participationMode,
            shadowDayCount: member.shadowDayCount,
          }))}
          planningMonthId={month.id}
        />
      ) : null}

      {scheduleRun ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {isPreview
                  ? `Preview · version ${scheduleRun.version}`
                  : month.status === "PUBLISHED"
                    ? "Published schedule"
                    : "Candidate schedule"}
              </CardTitle>
              <CardDescription>
                Version {scheduleRun.version} · generated{" "}
                {formatDate(scheduleRun.generatedAt.toISOString().slice(0, 10))}
                {" · "}primary fairness score {scheduleRun.fairnessScore} ·
                lower is more balanced
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isPreview ? (
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    Historical version preview. This is not the current
                    schedule.
                  </p>
                  {currentScheduleRun ? (
                    <Button
                      nativeButton={false}
                      render={<Link href={`/admin/months/${month.id}`} />}
                      size="sm"
                      variant="outline"
                    >
                      Back to current version
                    </Button>
                  ) : null}
                </div>
              ) : scheduleRun.publishedAt ? (
                <p className="mb-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Published{" "}
                  {formatDate(
                    scheduleRun.publishedAt.toISOString().slice(0, 10),
                  )}{" "}
                  · this is the official schedule.
                </p>
              ) : month.status === "GENERATED" ? (
                <div className="mb-5 rounded-xl border bg-muted/30 p-4">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Review the primary assignments, shadow pairings, and
                    workload above, then publish this candidate for the team.
                  </p>
                  <PublishScheduleForm scheduleRunId={scheduleRun.id} />
                </div>
              ) : null}
              {isPreview ? (
                <>
                  {scheduleRun.revisionReason || previewWarnings.length ? (
                    <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                      {scheduleRun.revisionReason ? (
                        <p className="text-sm text-muted-foreground">
                          {scheduleRun.revisionReason}
                        </p>
                      ) : null}
                      {previewWarnings.length ? (
                        <ul className="grid gap-1 text-sm text-amber-700 dark:text-amber-300">
                          {previewWarnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                  <ScheduleCalendar
                    assignments={scheduleRun.assignments}
                    members={month.members.map((member) => ({
                      id: member.id,
                      nameSnapshot: member.nameSnapshot,
                      roleSnapshot: member.roleSnapshot,
                      phoneNumber: member.user.phoneNumber,
                    }))}
                    month={month.month}
                    year={month.year}
                  />
                </>
              ) : scheduleSnapshot ? (
                <ScheduleEditor
                  key={scheduleRun.id}
                  assignments={scheduleRun.assignments}
                  isPublished={month.status === "PUBLISHED"}
                  members={editorMembers}
                  month={month.month}
                  scheduleRunId={scheduleRun.id}
                  today={getOperationalDate()}
                  year={month.year}
                />
              ) : (
                <p className="text-sm text-destructive">
                  This schedule is missing its original availability snapshot
                  and cannot be edited.
                </p>
              )}
              {isPreview && currentScheduleRun ? (
                <div className="mt-5">
                  <RestoreScheduleForm
                    currentScheduleHref={`/admin/months/${month.id}`}
                    isPublished={month.status === "PUBLISHED"}
                    sourceRunId={scheduleRun.id}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {month.scheduleRuns.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>Version history</CardTitle>
                <CardDescription>
                  Every saved edit preserves the previous schedule.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="grid gap-3">
                  {month.scheduleRuns.map((run) => {
                    const warnings = parseScheduleWarnings(
                      run.validationWarnings,
                    );
                    return (
                      <li className="rounded-lg border p-3" key={run.id}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">
                            Version {run.version}
                          </span>
                          {run.id === currentScheduleRun?.id ? (
                            <Badge variant="secondary">current</Badge>
                          ) : null}
                          {run.publishedAt ? (
                            <Badge variant="outline">published</Badge>
                          ) : null}
                          {warnings.length ? (
                            <Badge variant="outline">
                              {warnings.length} exception
                              {warnings.length === 1 ? "" : "s"}
                            </Badge>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(
                              run.generatedAt.toISOString().slice(0, 10),
                            )}
                          </span>
                          {run.id !== currentScheduleRun?.id ? (
                            <Button
                              className="ml-auto"
                              nativeButton={false}
                              render={
                                <Link
                                  href={`/admin/months/${month.id}?version=${run.id}`}
                                />
                              }
                              size="sm"
                              variant="outline"
                            >
                              Preview
                            </Button>
                          ) : null}
                        </div>
                        {run.revisionReason ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {run.revisionReason}
                          </p>
                        ) : null}
                        {warnings.length ? (
                          <ul className="mt-2 grid gap-1 text-sm text-amber-700 dark:text-amber-300">
                            {warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {month.status === "READY"
                ? "Ready to generate"
                : "Schedule not ready"}
            </CardTitle>
            <CardDescription>
              {month.status === "READY"
                ? "Everyone has submitted. Generate a candidate to review primary assignments, shadow pairings, and workload."
                : "The candidate schedule becomes available after every participant submits availability."}
            </CardDescription>
          </CardHeader>
          {month.status === "READY" ? (
            <CardContent>
              <GenerateScheduleForm planningMonthId={month.id} />
            </CardContent>
          ) : null}
        </Card>
      )}
    </div>
  );
}
