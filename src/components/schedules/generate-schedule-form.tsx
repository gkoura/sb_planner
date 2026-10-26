"use client";

import { useActionState } from "react";

import {
  createScheduleRun,
  type GenerateScheduleState,
} from "@/app/actions/schedules";
import { Button } from "@/components/ui/button";

const initialState: GenerateScheduleState = {};

export function GenerateScheduleForm({ planningMonthId }: { planningMonthId: string }) {
  const [state, formAction, isPending] = useActionState(
    createScheduleRun,
    initialState,
  );

  return (
    <form action={formAction} className="grid justify-items-start gap-3">
      <input name="planningMonthId" type="hidden" value={planningMonthId} />
      <Button disabled={isPending} type="submit">
        {isPending ? "Generating…" : "Generate candidate schedule"}
      </Button>
      <div aria-atomic="true" aria-live="polite">
        {state.error ? <p className="max-w-xl text-sm text-destructive" role="alert">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">{state.success}</p> : null}
      </div>
    </form>
  );
}
