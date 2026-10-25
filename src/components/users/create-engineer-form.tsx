"use client";

import { useActionState } from "react";

import {
  createEngineer,
  type CreateEngineerState,
} from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CreateEngineerState = {};

export function CreateEngineerForm() {
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
      <div className="grid gap-2">
        <Label htmlFor="engineer-password">Temporary password</Label>
        <Input
          autoComplete="new-password"
          id="engineer-password"
          minLength={8}
          name="password"
          required
          type="password"
        />
        <p className="text-sm text-muted-foreground">
          Share this securely. Password changes will be added with account
          settings.
        </p>
      </div>
      <div aria-atomic="true" aria-live="polite">
        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
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
