"use client";

import { useActionState, useState } from "react";

import {
    saveParticipationSettings,
    type ParticipationSettingsState,
} from "@/app/actions/planning-months";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

type ParticipantSetting = {
    id: string;
    nameSnapshot: string;
    participationMode: "NORMAL" | "TRAINEE" | "MENTORED";
    shadowDayCount: number;
};

const initialState: ParticipationSettingsState = {};

export function ParticipationSettingsForm({
    planningMonthId,
    members,
    maxShadowDays,
}: {
    planningMonthId: string;
    members: ParticipantSetting[];
    maxShadowDays: number;
}) {
    const [state, formAction, isPending] = useActionState(
        saveParticipationSettings,
        initialState,
    );
    const [modes, setModes] = useState(
        () =>
            new Map(
                members.map((member) => [member.id, member.participationMode]),
            ),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Participation settings</CardTitle>
                <CardDescription>
                    Set each person’s role for this month. Trainees shadow
                    without primary days; mentored participants get a mentor on
                    each of their primary days.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form action={formAction} className="grid gap-4">
                    <input
                        name="planningMonthId"
                        type="hidden"
                        value={planningMonthId}
                    />
                    <div className="grid gap-3">
                        {members.map((member) => {
                            const currentMode =
                                modes.get(member.id) ??
                                member.participationMode;
                            return (
                                <fieldset
                                    className={`grid gap-3 rounded-xl border p-4 sm:items-end ${currentMode === "TRAINEE" ? "sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)_8rem]" : "sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)]"}`}
                                    key={member.id}
                                >
                                    <legend className="px-1 text-sm font-semibold">
                                        {member.nameSnapshot}
                                    </legend>
                                    <div className="grid gap-1.5">
                                        <label
                                            className="text-xs font-medium"
                                            htmlFor={`mode-${member.id}`}
                                        >
                                            Participation
                                        </label>
                                        <select
                                            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
                                            defaultValue={
                                                member.participationMode
                                            }
                                            disabled={isPending}
                                            id={`mode-${member.id}`}
                                            name={`mode:${member.id}`}
                                            onChange={(event) =>
                                                setModes((current) =>
                                                    new Map(current).set(
                                                        member.id,
                                                        event.target
                                                            .value as ParticipantSetting["participationMode"],
                                                    ),
                                                )
                                            }
                                        >
                                            <option value="NORMAL">
                                                Normal rotation
                                            </option>
                                            <option value="TRAINEE">
                                                Trainee · shadows only
                                            </option>
                                            <option value="MENTORED">
                                                Own days with a mentor
                                            </option>
                                        </select>
                                    </div>
                                    {currentMode === "TRAINEE" ? (
                                        <div className="grid gap-1.5">
                                            <label
                                                className="text-xs font-medium"
                                                htmlFor={`shadow-days-${member.id}`}
                                            >
                                                Shadow days
                                            </label>
                                            <input
                                                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
                                                defaultValue={
                                                    member.shadowDayCount
                                                }
                                                disabled={isPending}
                                                id={`shadow-days-${member.id}`}
                                                max={maxShadowDays}
                                                min={1}
                                                name={`shadowDays:${member.id}`}
                                                type="number"
                                            />
                                        </div>
                                    ) : null}
                                    <p
                                        className={`text-muted-foreground text-xs ${currentMode === "TRAINEE" ? "sm:col-span-3" : "sm:col-span-2"}`}
                                    >
                                        {currentMode === "TRAINEE"
                                            ? `The scheduler spreads these days through the month and rotates across the primary assignees. Maximum ${maxShadowDays} to avoid consecutive shadow days.`
                                            : currentMode === "MENTORED"
                                              ? "All other non-trainee participants can mentor. Mentor availability and consecutive-day rules are enforced."
                                              : "This participant receives primary standby assignments and may mentor others."}
                                    </p>
                                </fieldset>
                            );
                        })}
                    </div>
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
                            ? "Saving settings…"
                            : "Save participation settings"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
