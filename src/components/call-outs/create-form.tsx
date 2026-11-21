"use client";

import { useActionState, useState } from "react";
import { createCallOut } from "@/app/actions/call-outs";
import { SaveCallOutButton } from "@/components/call-outs/save-button";
import { DateTimePicker } from "@/components/ui/date-time-picker";

export function CreateCallOutForm({ submissionId }: { submissionId: string }) {
    const [state, action] = useActionState(createCallOut, {});
    const [reason, setReason] = useState("");
    const [role, setRole] = useState("PRIMARY");

    return (
        <form action={action} className="mt-6 grid gap-5">
            <input type="hidden" name="submissionId" value={submissionId} />
            {state.error && (
                <p role="alert" className="text-destructive text-sm">
                    {state.error}
                </p>
            )}
            <label className="grid gap-1.5 text-sm font-medium">
                Reason
                <textarea
                    name="reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    required
                    maxLength={2000}
                    rows={3}
                    placeholder={
                        "Describe the reason for the call-out...\n" +
                        "e.g. Job: P.JW.GR.CMS.COSMOS.MASSISSKA.MASS_KA_8.BAT Ended NOT Ok"
                    }
                    className="border-input bg-background placeholder:text-muted-foreground rounded-md border p-3 text-sm"
                />
            </label>

            <label className="grid gap-1.5 text-sm font-medium">
                Duty role
                <select
                    name="role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    required
                    className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                >
                    <option value="PRIMARY">Primary</option>

                    <option value="TRAINEE">Trainee (shadow)</option>

                    <option value="MENTOR">Mentor</option>

                    <option value="SUPPORT">Support</option>
                    <option value="OVERTIME">Overtime</option>
                </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
                <DateTimePicker name="start" label="Start" />

                <DateTimePicker name="end" label="End" />
            </div>

            <p className="text-muted-foreground text-xs">
                All dates and times are interpreted in Europe/Athens (24-hour
                format).
            </p>

            <div className="flex justify-end border-t pt-5">
                <SaveCallOutButton />
            </div>
        </form>
    );
}
