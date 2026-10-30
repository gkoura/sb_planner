"use client";

import { useActionState } from "react";
import {
    changeUserActiveState,
    type ChangeUserRoleState,
} from "@/app/actions/users";
import { Button } from "@/components/ui/button";

export function UserStatusForm({
    userId,
    userName,
    isActive,
}: {
    userId: string;
    userName: string;
    isActive: boolean;
}) {
    const [state, action, pending] = useActionState(
        changeUserActiveState,
        {} as ChangeUserRoleState,
    );
    const label = isActive ? "Deactivate" : "Reactivate";
    return (
        <div className="grid justify-items-end gap-1">
            <form action={action}>
                <input type="hidden" name="userId" value={userId} />
                <input
                    type="hidden"
                    name="isActive"
                    value={String(!isActive)}
                />
                <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    aria-label={`${label}: ${userName}`}
                >
                    {pending ? "Saving…" : label}
                </Button>
            </form>
            <p
                aria-live="polite"
                className={`max-w-56 text-right text-xs ${state.error ? "text-destructive" : "text-muted-foreground"}`}
            >
                {state.error ?? state.success}
            </p>
        </div>
    );
}
