"use client";

import { useActionState, useState } from "react";
import { CalendarDays } from "lucide-react";

import {
    createPlanningMonth,
    type CreatePlanningMonthState,
} from "@/app/actions/planning-months";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type EngineerOption = {
    email: string;
    id: string;
    name: string;
};

type CreatePlanningMonthFormProps = {
    adminName: string;
    engineers: EngineerOption[];
    monthValue: string;
};

const initialState: CreatePlanningMonthState = {};
const MONTHS = [
    ["01", "January"],
    ["02", "February"],
    ["03", "March"],
    ["04", "April"],
    ["05", "May"],
    ["06", "June"],
    ["07", "July"],
    ["08", "August"],
    ["09", "September"],
    ["10", "October"],
    ["11", "November"],
    ["12", "December"],
] as const;

export function CreatePlanningMonthForm({
    adminName,
    engineers,
    monthValue,
}: CreatePlanningMonthFormProps) {
    const [state, formAction, isPending] = useActionState(
        createPlanningMonth,
        initialState,
    );
    const [initialYear, initialMonth] = monthValue.split("-");
    const [selectedYear, setSelectedYear] = useState(initialYear);
    const [selectedMonth, setSelectedMonth] = useState(initialMonth);
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 21 }, (_, index) =>
        String(currentYear - 5 + index),
    );

    return (
        <form action={formAction} className="grid gap-5">
            <div className="bg-muted/30 grid gap-3 rounded-xl border p-4">
                <div className="flex items-start gap-3">
                    <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-lg">
                        <CalendarDays aria-hidden="true" className="size-4" />
                    </span>
                    <div className="grid gap-0.5">
                        <label
                            className="text-sm font-semibold"
                            htmlFor="planning-month"
                        >
                            Planning month
                        </label>
                        <p className="text-muted-foreground text-xs">
                            Choose the calendar month this standby rotation
                            covers.
                        </p>
                    </div>
                </div>

                <input
                    name="month"
                    type="hidden"
                    value={`${selectedYear}-${selectedMonth}`}
                />
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                    <div className="grid gap-1.5">
                        <label
                            className="text-xs font-medium"
                            htmlFor="planning-month"
                        >
                            Month
                        </label>
                        <Select
                            onValueChange={(value) => {
                                if (value) setSelectedMonth(value);
                            }}
                            value={selectedMonth}
                        >
                            <SelectTrigger
                                className="h-11 w-full"
                                disabled={isPending}
                                id="planning-month"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="start">
                                {MONTHS.map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-1.5">
                        <label
                            className="text-xs font-medium"
                            htmlFor="planning-year"
                        >
                            Year
                        </label>
                        <Select
                            onValueChange={(value) => {
                                if (value) setSelectedYear(value);
                            }}
                            value={selectedYear}
                        >
                            <SelectTrigger
                                className="h-11 w-full"
                                disabled={isPending}
                                id="planning-year"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                                {years.map((year) => (
                                    <SelectItem key={year} value={year}>
                                        {year}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <fieldset className="grid gap-3" disabled={isPending}>
                <legend className="mb-1 text-sm font-medium">
                    Participants
                </legend>
                {engineers.length > 0 ? (
                    engineers.map((engineer) => (
                        <label
                            className="flex cursor-pointer items-start gap-3"
                            key={engineer.id}
                        >
                            <input
                                className="accent-primary mt-1 size-4"
                                name="memberIds"
                                type="checkbox"
                                value={engineer.id}
                            />
                            <span className="grid gap-0.5">
                                <span className="text-sm font-medium">
                                    {engineer.name}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    {engineer.email}
                                </span>
                            </span>
                        </label>
                    ))
                ) : (
                    <p className="text-muted-foreground text-sm">
                        Add at least one engineer account, or include yourself
                        below.
                    </p>
                )}

                <label className="flex cursor-pointer items-start gap-3 border-t pt-3">
                    <input
                        className="accent-primary mt-1 size-4"
                        name="includeAdmin"
                        type="checkbox"
                        value="true"
                    />
                    <span className="grid gap-0.5">
                        <span className="text-sm font-medium">Include me</span>
                        <span className="text-muted-foreground text-xs">
                            {adminName} will submit availability and can be
                            assigned standby. This does not use an engineer
                            account slot.
                        </span>
                    </span>
                </label>
            </fieldset>

            <div aria-atomic="true" aria-live="polite">
                {state.error ? (
                    <p className="text-destructive text-sm" role="alert">
                        {state.error}
                    </p>
                ) : null}
                {state.success ? (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        {state.success}
                    </p>
                ) : null}
            </div>

            <Button disabled={isPending} type="submit">
                {isPending ? "Creating month…" : "Create draft month"}
            </Button>
        </form>
    );
}
