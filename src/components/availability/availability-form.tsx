"use client";

import { useActionState } from "react";
import { useState } from "react";

import {
  submitAvailability,
  type AvailabilityState,
} from "@/app/actions/availability";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

type AvailabilityFormProps = {
  checkedDates: string[];
  mode: "AVAILABLE" | "UNAVAILABLE";
  planningMonthId: string;
  month: number;
  year: number;
};

const initialState: AvailabilityState = {};

function toLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateValue(value: Date) {
  const year = String(value.getFullYear()).padStart(4, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthDateValues(year: number, month: number) {
  const dayCount = new Date(year, month, 0).getDate();
  return Array.from(
    { length: dayCount },
    (_, index) =>
      `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
  );
}

export function AvailabilityForm({
  checkedDates,
  mode,
  planningMonthId,
  month,
  year,
}: AvailabilityFormProps) {
  const [state, formAction, isPending] = useActionState(
    submitAvailability,
    initialState,
  );
  const monthDateValues = useMemo(
    () => getMonthDateValues(year, month),
    [month, year],
  );
  const [selectedDates, setSelectedDates] = useState<Date[]>(() =>
    (mode === "UNAVAILABLE"
      ? checkedDates
      : monthDateValues.filter((date) => !checkedDates.includes(date))
    ).map(toLocalDate),
  );
  const selectedDateValues = selectedDates.map(toDateValue).sort();
  const availableCount = monthDateValues.length - selectedDateValues.length;

  return (
    <form action={formAction} className="grid gap-5">
      <input name="planningMonthId" type="hidden" value={planningMonthId} />
      <input name="mode" type="hidden" value="UNAVAILABLE" />
      {selectedDateValues.map((date) => (
        <input key={date} name="dates" type="hidden" value={date} />
      ))}

      <section aria-label="Choose calendar dates" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">
              Tap any day you can&apos;t cover
            </h2>
            <p className="text-sm text-muted-foreground">
              Days start green (available). Tap once to mark a day unavailable;
              tap again to make it available.
            </p>
          </div>
          <div aria-live="polite" className="flex items-center gap-2">
            <Badge
              className="border-emerald-300 bg-emerald-100 text-emerald-900"
              variant="outline"
            >
              {availableCount} available
            </Badge>
            <Badge
              className="border-red-300 bg-red-100 text-red-900"
              variant="outline"
            >
              {selectedDates.length} unavailable
            </Badge>
          </div>
        </div>
        <Calendar
          aria-label={`Select ${new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1))} availability`}
          className="mx-auto w-full max-w-2xl rounded-xl border bg-background p-2 [--cell-size:--spacing(9)] sm:p-4 sm:[--cell-size:--spacing(12)]"
          disableNavigation
          mode="multiple"
          month={new Date(year, month - 1, 1)}
          onSelect={(dates) => setSelectedDates(dates ?? [])}
          classNames={{
            day_button:
              "bg-emerald-700 text-white hover:bg-emerald-800 data-[selected=true]:bg-red-700 data-[selected=true]:text-white data-[selected=true]:hover:bg-red-800 dark:bg-emerald-700 dark:text-white dark:hover:bg-emerald-800 dark:data-[selected=true]:bg-red-700 dark:data-[selected=true]:text-white dark:data-[selected=true]:hover:bg-red-800",
          }}
          selected={selectedDates}
          showOutsideDays={false}
          weekStartsOn={1}
        />
        {selectedDates.length > 0 ? (
          <Button
            className="w-fit"
            disabled={isPending}
            onClick={() => setSelectedDates([])}
            size="sm"
            type="button"
            variant="ghost"
          >
            Mark all days available
          </Button>
        ) : null}
      </section>

      <div aria-atomic="true" aria-live="polite">
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p
            className="text-sm text-emerald-700 dark:text-emerald-400"
            role="status"
          >
            {state.success}
          </p>
        ) : null}
      </div>
      <Button className="h-11 w-fit px-5" disabled={isPending} type="submit">
        {isPending ? "Submitting…" : "Submit availability"}
      </Button>
    </form>
  );
}
