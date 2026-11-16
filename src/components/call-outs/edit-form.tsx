"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateCallOut } from "@/app/actions/call-outs";
import { SaveCallOutButton } from "@/components/call-outs/save-button";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";

export function EditCallOutForm({
    entry,
}: {
    entry: {
        id: string;
        reason: string;
        role: string;
        start: string;
        end: string;
    };
}) {
    const [state, action] = useActionState(updateCallOut, {});
    const [reason, setReason] = useState(entry.reason);
    const [role, setRole] = useState(entry.role);
    return (
        <form
            action={action}
            className="bg-card grid gap-5 rounded-2xl border p-6"
        >
            <input type="hidden" name="id" value={entry.id} />
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
                    className="border-input bg-background rounded-md border p-3 text-sm"
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
                <DateTimePicker
                    name="start"
                    label="Start"
                    defaultValue={entry.start}
                />
                <DateTimePicker
                    name="end"
                    label="End"
                    defaultValue={entry.end}
                />
            </div>
            <p className="text-muted-foreground text-xs">
                Choose Support when helping another standby member, or Overtime
                for extra work unrelated to standby. Overtime has no standby
                date. Rounded daily hours are recalculated when you save.
            </p>
            <div className="flex justify-end gap-2 border-t pt-5">
                <Button
                    nativeButton={false}
                    render={<Link href="/call-outs" />}
                    variant="outline"
                >
                    Cancel
                </Button>
                <SaveCallOutButton />
            </div>
        </form>
    );
}
