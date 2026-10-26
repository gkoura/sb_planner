"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  restoreScheduleRun,
  type RestoreScheduleState,
} from "@/app/actions/schedules";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const initialState: RestoreScheduleState = {};

export function RestoreScheduleForm({
  sourceRunId,
  isPublished,
  currentScheduleHref,
}: {
  sourceRunId: string;
  isPublished: boolean;
  currentScheduleHref: string;
}) {
  const [state, formAction, isPending] = useActionState(restoreScheduleRun, initialState);

  return (
    <form action={formAction} className="grid gap-3 rounded-xl border bg-muted/20 p-4">
      <input name="sourceRunId" type="hidden" value={sourceRunId} />
      <div>
        <p className="text-sm font-semibold">Restore this version</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This creates a new version and preserves the current schedule in history.
        </p>
      </div>
      {isPublished ? (
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input className="mt-0.5 size-4 accent-primary" name="allowPastChanges" type="checkbox" value="true" />
          <span>Allow this restore to correct past dates.</span>
        </label>
      ) : null}
      <div className="grid gap-1.5">
        <label className="text-xs font-medium" htmlFor="restore-reason">Reason for restoring (required)</label>
        <Textarea
          id="restore-reason"
          maxLength={500}
          name="revisionReason"
          placeholder="Explain why this version should become current."
          required
          rows={2}
        />
      </div>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.success ? (
        <div aria-live="polite" className="grid gap-2">
          <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">{state.success}</p>
          <Button className="w-fit" render={<Link href={currentScheduleHref} />} size="sm" variant="outline">
            View current version
          </Button>
        </div>
      ) : null}
      <Button className="w-fit" disabled={isPending} type="submit" variant="outline">
        {isPending ? "Restoring…" : isPublished ? "Restore as new published version" : "Restore as new candidate version"}
      </Button>
    </form>
  );
}
