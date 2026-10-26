"use client";

import { useActionState, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, UserRound } from "lucide-react";

import { saveAccountProfile, type AccountProfileState } from "@/app/actions/account";
import { authClient } from "@/lib/auth-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialProfileState: AccountProfileState = { status: "idle", message: "" };

function FormNotice({ state }: { state: AccountProfileState }) {
  if (state.status === "idle") return null;
  return (
    <Alert aria-live="polite" variant={state.status === "error" ? "destructive" : "default"}>
      {state.status === "success" ? <Check aria-hidden="true" /> : null}
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

export function ProfileSettingsForm({
  name,
  phoneNumber,
  email,
}: {
  name: string;
  phoneNumber: string | null;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(saveAccountProfile, initialProfileState);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <UserRound aria-hidden="true" className="size-5" />
          </span>
          <div>
            <CardTitle>Profile</CardTitle>
            <CardDescription className="mt-1">Keep your team contact details up to date.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="account-name">Display name</Label>
            <Input autoComplete="name" defaultValue={name} id="account-name" maxLength={80} minLength={2} name="name" required />
            <p className="text-xs text-muted-foreground">Schedule history keeps the name recorded when each month was created.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="account-email">Email</Label>
            <Input autoComplete="email" id="account-email" readOnly value={email} />
            <p className="text-xs text-muted-foreground">Email changes need a verification flow and aren’t available yet.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="account-phone">Phone number</Label>
            <Input autoComplete="tel" defaultValue={phoneNumber ?? ""} id="account-phone" inputMode="tel" name="phoneNumber" placeholder="+306912345678" type="tel" />
            <p className="text-xs text-muted-foreground">Use the international format with country code. Your team can see this number on standby schedules.</p>
          </div>
          <FormNotice state={state} />
          <div>
            <Button disabled={pending} type="submit">{pending ? "Saving…" : "Save profile"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function ChangePasswordForm() {
  const [showPasswords, setShowPasswords] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<AccountProfileState>(initialProfileState);

  async function changePassword(formData: FormData) {
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword.length < 8) {
      setNotice({ status: "error", message: "Choose a password with at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ status: "error", message: "The new passwords don’t match." });
      return;
    }

    setPending(true);
    setNotice(initialProfileState);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setNotice({ status: "error", message: result.error.message ?? "The password could not be changed." });
        return;
      }
      setNotice({ status: "success", message: "Your password has been changed. Other sessions have been signed out." });
      (document.getElementById("change-password-form") as HTMLFormElement | null)?.reset();
    } catch {
      setNotice({ status: "error", message: "The password could not be changed. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground">
            <KeyRound aria-hidden="true" className="size-5" />
          </span>
          <div>
            <CardTitle>Password</CardTitle>
            <CardDescription className="mt-1">Confirm your current password before setting a new one.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form action={changePassword} className="grid gap-5" id="change-password-form">
          <div className="grid gap-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input autoComplete="current-password" id="current-password" name="currentPassword" required type={showPasswords ? "text" : "password"} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-password">New password</Label>
            <Input autoComplete="new-password" id="new-password" minLength={8} name="newPassword" required type={showPasswords ? "text" : "password"} />
            <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input autoComplete="new-password" id="confirm-password" minLength={8} name="confirmPassword" required type={showPasswords ? "text" : "password"} />
          </div>
          <Button className="w-fit" onClick={() => setShowPasswords((visible) => !visible)} type="button" variant="ghost">
            {showPasswords ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            {showPasswords ? "Hide passwords" : "Show passwords"}
          </Button>
          <FormNotice state={notice} />
          <div>
            <Button disabled={pending} type="submit">{pending ? "Updating…" : "Change password"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
