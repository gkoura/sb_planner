"use client";

import { useActionState } from "react";

import {
    clearAvailabilityForMember,
    type AvailabilityState,
} from "@/app/actions/availability";
import { Button } from "@/components/ui/button";

const initialState: AvailabilityState = {};

export function ClearAvailabilityForm({
    planningMonthId,
    planningMemberId,
    memberName,
}: {
    planningMonthId: string;
    planningMemberId: string;
    memberName: string;
}) {
    const [state, formAction, isPending] = useActionState(
        clearAvailabilityForMember,
        initialState,
    );

    return (
        <form
            action={formAction}
            className="grid justify-items-start gap-2"
            onSubmit={(event) => {
                if (
                    !window.confirm(
                        `Clear ${memberName}'s availability? They will be marked as needing a submission.`,
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
            <input
                name="planningMemberId"
                type="hidden"
                value={planningMemberId}
            />
            <Button
                disabled={isPending}
                size="sm"
                type="submit"
                variant="outline"
            >
                {isPending ? "Clearing…" : "Clear submission"}
            </Button>
            {state.error ? (
                <p className="text-destructive text-sm" role="alert">
                    {state.error}
                </p>
            ) : null}
        </form>
    );
}
