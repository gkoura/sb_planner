"use client";

import { useActionState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";

import { changeUserRole, type ChangeUserRoleState } from "@/app/actions/users";
import { Button } from "@/components/ui/button";

const initialState: ChangeUserRoleState = {};

export function UserRoleForm({
    userId,
    userName,
    role,
}: {
    userId: string;
    userName: string;
    role: string;
}) {
    const [state, formAction, pending] = useActionState(
        changeUserRole,
        initialState,
    );
    const nextRole = role === "ADMIN" ? "ENGINEER" : "ADMIN";
    const label = role === "ADMIN" ? "Remove admin" : "Make admin";

    return (
        <div className="grid justify-items-end gap-1">
            <form action={formAction}>
                <input name="userId" type="hidden" value={userId} />
                <input name="role" type="hidden" value={nextRole} />
                <Button
                    aria-label={`${label}: ${userName}`}
                    disabled={pending}
                    size="sm"
                    type="submit"
                    variant="outline"
                >
                    {role === "ADMIN" ? (
                        <ShieldOff aria-hidden="true" />
                    ) : (
                        <ShieldCheck aria-hidden="true" />
                    )}
                    {pending ? "Saving…" : label}
                </Button>
            </form>
            {state.error || state.success ? (
                <p
                    aria-live="polite"
                    className={`max-w-56 text-right text-xs ${state.error ? "text-destructive" : "text-muted-foreground"}`}
                >
                    {state.error ?? state.success}
                </p>
            ) : null}
        </div>
    );
}
