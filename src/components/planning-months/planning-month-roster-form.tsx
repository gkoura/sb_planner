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

import { MemberPicker, type MemberOption } from "./member-picker";

const initialState: PlanningMonthRosterState = {};

export function PlanningMonthRosterForm({
    planningMonthId,
    members,
    selectedMemberIds,
}: {
    planningMonthId: string;
    members: MemberOption[];
    selectedMemberIds: string[];
}) {
    const [state, formAction, isPending] = useActionState(
        savePlanningMonthRoster,
        initialState,
    );

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
                    <input name="rosterVersion" type="hidden" value="2" />
                    <MemberPicker
                        members={members}
                        disabled={isPending}
                        selectedMemberIds={selectedMemberIds}
                    />

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
