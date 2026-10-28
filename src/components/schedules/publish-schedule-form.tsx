"use client";

import { useActionState } from "react";

import {
    publishScheduleRun,
    type PublishScheduleState,
} from "@/app/actions/schedules";
import { Button } from "@/components/ui/button";

const initialState: PublishScheduleState = {};

export function PublishScheduleForm({
    scheduleRunId,
}: {
    scheduleRunId: string;
}) {
    const [state, formAction, isPending] = useActionState(
        publishScheduleRun,
        initialState,
    );

    return (
        <form action={formAction} className="grid justify-items-start gap-3">
            <input name="scheduleRunId" type="hidden" value={scheduleRunId} />
            <Button disabled={isPending} type="submit">
                {isPending ? "Publishing…" : "Publish schedule"}
            </Button>
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
        </form>
    );
}
