"use client";

import { useActionState } from "react";

import {
    createPlanningMonth,
    type CreatePlanningMonthState,
} from "@/app/actions/planning-months";
import { Button } from "@/components/ui/button";

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

export function CreatePlanningMonthForm({
    adminName,
    engineers,
    monthValue,
}: CreatePlanningMonthFormProps) {
    const [state, formAction, isPending] = useActionState(
        createPlanningMonth,
        initialState,
    );

    return (
        <form action={formAction} className="grid gap-5">
            <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="planning-month">
                    Month
                </label>
                <input
                    className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:ring-3"
                    defaultValue={monthValue}
                    id="planning-month"
                    name="month"
                    required
                    type="month"
                />
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
