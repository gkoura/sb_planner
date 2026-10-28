"use client";

import { useActionState } from "react";

import {
    deleteDraftPlanningMonth,
    type DeletePlanningMonthState,
} from "@/app/actions/planning-months";
import { Button } from "@/components/ui/button";

const initialState: DeletePlanningMonthState = {};

export function DeleteDraftMonthForm({
    planningMonthId,
    monthName,
}: {
    planningMonthId: string;
    monthName: string;
}) {
    const [state, formAction, isPending] = useActionState(
        deleteDraftPlanningMonth,
        initialState,
    );

    return (
        <form
            action={formAction}
            className="grid justify-items-end gap-1"
            onSubmit={(event) => {
                if (
                    !window.confirm(
                        `Delete the ${monthName} draft? This cannot be undone.`,
                    )
                ) {
                    event.preventDefault();
                }
            }}
        >
            <input
                name="planningMonthId"
                type="hidden"
                value={planningMonthId}
            />
            <Button
                disabled={isPending}
                size="sm"
                type="submit"
                variant="destructive"
            >
                {isPending ? "Deleting…" : "Delete draft"}
            </Button>
            {state.error ? (
                <p className="text-destructive text-right text-xs" role="alert">
                    {state.error}
                </p>
            ) : null}
        </form>
    );
}
