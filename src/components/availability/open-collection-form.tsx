"use client";

import { useActionState } from "react";

import {
  openPlanningCollection,
  type AvailabilityState,
} from "@/app/actions/availability";
import { Button } from "@/components/ui/button";

const initialState: AvailabilityState = {};

export function OpenCollectionForm({
  planningMonthId,
}: {
  planningMonthId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    openPlanningCollection,
    initialState,
  );

  return (
    <form action={formAction} className="grid justify-items-start gap-2">
      <input name="planningMonthId" type="hidden" value={planningMonthId} />
      <Button disabled={isPending} size="sm" type="submit">
        {isPending ? "Opening…" : "Open availability"}
      </Button>
      <div aria-atomic="true" aria-live="polite">
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {state.success}
          </p>
        ) : null}
      </div>
    </form>
  );
}
