"use client";

import { useActionState } from "react";
import { useState } from "react";

import {
    submitAvailability,
    submitAvailabilityForMember,
    type AvailabilityState,
} from "@/app/actions/availability";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import {
    calendarDateValue,
    daysInCalendarMonth,
    localCalendarDate,
} from "@/lib/calendar-date";

type AvailabilityFormProps = {
    checkedDates: string[];
    hasSubmitted: boolean;
    mode: "AVAILABLE" | "UNAVAILABLE";
    planningMonthId: string;
    planningMemberId?: string;
    submitLabel?: string;
    month: number;
    year: number;
};

const initialState: AvailabilityState = {};
const calendarDateLib = {
    newDate: (year: number, monthIndex: number, day: number) =>
        localCalendarDate(year, monthIndex + 1, day),
};

function toLocalDate(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return localCalendarDate(year, month, day);
}

function toDateValue(value: Date) {
    const year = String(value.getFullYear()).padStart(4, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getMonthDateValues(year: number, month: number) {
    const dayCount = daysInCalendarMonth(year, month);
    return Array.from({ length: dayCount }, (_, index) =>
        calendarDateValue(year, month, index + 1),
    );
}

export function AvailabilityForm({
    checkedDates,
    hasSubmitted,
    mode,
    planningMonthId,
    planningMemberId,
    submitLabel,
    month,
    year,
}: AvailabilityFormProps) {
    const [state, formAction, isPending] = useActionState(
        planningMemberId ? submitAvailabilityForMember : submitAvailability,
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
    const actionLabel =
        submitLabel ??
        (hasSubmitted ? "Modify availability" : "Submit availability");
    const pendingLabel = hasSubmitted ? "Saving changes…" : "Submitting…";

    return (
        <form action={formAction} className="grid gap-5">
            <input
                name="planningMonthId"
                type="hidden"
                value={planningMonthId}
            />
            {planningMemberId ? (
                <input
                    name="planningMemberId"
                    type="hidden"
                    value={planningMemberId}
                />
            ) : null}
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
                        <p className="text-muted-foreground text-sm">
                            Days start green (available). Tap once to mark a day
                            unavailable; tap again to make it available.
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
                    aria-label={`Select ${new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(localCalendarDate(year, month, 1))} availability`}
                    className="bg-background mx-auto w-full max-w-2xl rounded-xl border p-2 [--cell-size:--spacing(9)] sm:p-4 sm:[--cell-size:--spacing(12)]"
                    disableNavigation
                    dateLib={calendarDateLib}
                    mode="multiple"
                    month={localCalendarDate(year, month, 1)}
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
                    <p className="text-destructive text-sm" role="alert">
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
            <Button
                className="h-11 w-fit px-5"
                disabled={isPending}
                type="submit"
            >
                {isPending ? pendingLabel : actionLabel}
            </Button>
        </form>
    );
}
