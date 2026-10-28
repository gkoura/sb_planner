"use client";

import { useActionState } from "react";

import {
    savePlanningMonthRoster,
    type PlanningMonthRosterState,
} from "@/app/actions/planning-months";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

type EngineerOption = {
    email: string;
    id: string;
    name: string;
};

const initialState: PlanningMonthRosterState = {};

export function PlanningMonthRosterForm({
    planningMonthId,
    engineers,
    selectedEngineerIds,
    includeAdmin,
    adminName,
}: {
    planningMonthId: string;
    engineers: EngineerOption[];
    selectedEngineerIds: string[];
    includeAdmin: boolean;
    adminName: string;
}) {
    const [state, formAction, isPending] = useActionState(
        savePlanningMonthRoster,
        initialState,
    );
    const selected = new Set(selectedEngineerIds);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Participants</CardTitle>
                <CardDescription>
                    Add or remove participants before schedule generation. A new
                    participant must submit availability; removing someone also
                    removes their saved availability for this month.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form action={formAction} className="grid gap-5">
                    <input
                        name="planningMonthId"
                        type="hidden"
                        value={planningMonthId}
                    />
                    <fieldset className="grid gap-3" disabled={isPending}>
                        <legend className="mb-1 text-sm font-medium">
                            Engineers
                        </legend>
                        {engineers.length ? (
                            engineers.map((engineer) => (
                                <label
                                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                                    key={engineer.id}
                                >
                                    <input
                                        className="accent-primary mt-1 size-4"
                                        defaultChecked={selected.has(
                                            engineer.id,
                                        )}
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
                                There are no engineer accounts to add.
                            </p>
                        )}

                        <label className="flex cursor-pointer items-start gap-3 border-t pt-3">
                            <input
                                className="accent-primary mt-1 size-4"
                                defaultChecked={includeAdmin}
                                name="includeAdmin"
                                type="checkbox"
                                value="true"
                            />
                            <span className="grid gap-0.5">
                                <span className="text-sm font-medium">
                                    Include me
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    {adminName} can submit availability and be
                                    assigned standby without using an engineer
                                    account slot.
                                </span>
                            </span>
                        </label>
                    </fieldset>

                    <div aria-atomic="true" aria-live="polite">
                        {state.error ? (
                            <p
                                className="text-destructive text-sm"
                                role="alert"
                            >
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
                        {isPending
                            ? "Saving participants…"
                            : "Save participants"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
