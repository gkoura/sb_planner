"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { createEngineer, type CreateEngineerState } from "@/app/actions/users";
import { PhoneNumberField } from "@/components/users/phone-number-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

const initialState: CreateEngineerState = {};

export function CreateEngineerForm() {
    const [showPassword, setShowPassword] = useState(false);
    const [state, formAction, isPending] = useActionState(
        createEngineer,
        initialState,
    );

    return (
        <form action={formAction} className="grid gap-4" noValidate>
            <div className="grid gap-2">
                <Label htmlFor="engineer-name">Name</Label>
                <Input
                    autoComplete="name"
                    id="engineer-name"
                    name="name"
                    required
                    maxLength={100}
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="engineer-email">Email</Label>
                <Input
                    autoComplete="email"
                    id="engineer-email"
                    name="email"
                    required
                    type="email"
                />
            </div>
            <PhoneNumberField idPrefix="engineer-phone" />
            <div className="grid gap-2">
                <Label htmlFor="engineer-password">Temporary password</Label>
                <InputGroup>
                    <InputGroupInput
                        autoComplete="new-password"
                        id="engineer-password"
                        minLength={8}
                        name="password"
                        required
                        type={showPassword ? "text" : "password"}
                    />
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton
                            aria-label={
                                showPassword ? "Hide password" : "Show password"
                            }
                            aria-pressed={showPassword}
                            className="cursor-pointer"
                            onClick={() =>
                                setShowPassword((visible) => !visible)
                            }
                            size="icon-xs"
                            title={
                                showPassword ? "Hide password" : "Show password"
                            }
                            type="button"
                        >
                            {showPassword ? (
                                <EyeOff aria-hidden="true" />
                            ) : (
                                <Eye aria-hidden="true" />
                            )}
                        </InputGroupButton>
                    </InputGroupAddon>
                </InputGroup>
                <p className="text-muted-foreground text-sm">
                    Share this securely. They can change it later in account
                    settings.
                </p>
            </div>
            <div aria-atomic="true" aria-live="polite">
                {state.error ? (
                    <p className="text-destructive text-sm">{state.error}</p>
                ) : null}
                {state.success ? (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        {state.success}
                    </p>
                ) : null}
            </div>
            <Button disabled={isPending} type="submit">
                {isPending ? "Creating account…" : "Create engineer"}
            </Button>
        </form>
    );
}
