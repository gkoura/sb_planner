"use client";

import { useActionState } from "react";

import {
  submitAvailability,
  type AvailabilityState,
} from "@/app/actions/availability";
import { Button } from "@/components/ui/button";

type AvailabilityFormProps = {
  checkedDates: string[];
  days: { date: string; label: string }[];
  mode: "AVAILABLE" | "UNAVAILABLE";
  planningMonthId: string;
};

const initialState: AvailabilityState = {};

export function AvailabilityForm({
  checkedDates,
  days,
  mode,
  planningMonthId,
}: AvailabilityFormProps) {
  const [state, formAction, isPending] = useActionState(
    submitAvailability,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-5">
      <input name="planningMonthId" type="hidden" value={planningMonthId} />
      <fieldset className="grid gap-3" disabled={isPending}>
        <legend className="text-sm font-medium">What are you entering?</legend>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            className="mt-1 size-4 accent-primary"
            defaultChecked={mode === "AVAILABLE"}
            name="mode"
            type="radio"
            value="AVAILABLE"
          />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">Available dates</span>
            <span className="text-xs text-muted-foreground">Only the dates you select are available.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            className="mt-1 size-4 accent-primary"
            defaultChecked={mode === "UNAVAILABLE"}
            name="mode"
            type="radio"
            value="UNAVAILABLE"
          />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">Unavailable dates</span>
            <span className="text-xs text-muted-foreground">All other dates are available.</span>
          </span>
        </label>
      </fieldset>

      <fieldset className="grid gap-3" disabled={isPending}>
        <legend className="text-sm font-medium">Select dates</legend>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {days.map((day) => (
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted" key={day.date}>
              <input
                className="size-4 accent-primary"
                defaultChecked={checkedDates.includes(day.date)}
                name="dates"
                type="checkbox"
                value={day.date}
              />
              <span className="text-sm">{day.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div aria-atomic="true" aria-live="polite">
        {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">{state.success}</p> : null}
      </div>
      <Button className="w-fit" disabled={isPending} type="submit">
        {isPending ? "Submitting…" : "Submit availability"}
      </Button>
    </form>
  );
}
