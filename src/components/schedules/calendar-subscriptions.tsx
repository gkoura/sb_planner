"use client";

import { useActionState, useState } from "react";
import {
    manageCalendarSubscription,
    type CalendarSubscriptionState,
} from "@/app/actions/calendar-subscriptions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

const initialState: CalendarSubscriptionState = {};

function Subscription({
    type,
    active,
}: {
    type: "ALL" | "PERSONAL";
    active: boolean;
}) {
    const [state, formAction, pending] = useActionState(
        manageCalendarSubscription,
        initialState,
    );
    const [copied, setCopied] = useState(false);
    const title = type === "ALL" ? "All standby dates" : "My standby dates";
    return (
        <div className="border-border grid gap-3 rounded-xl border p-4">
            <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-muted-foreground text-sm">
                    {type === "ALL"
                        ? "Primary standby for the whole team."
                        : "Your primary, shadowing, and mentoring days."}
                </p>
                <p className="text-muted-foreground text-sm">
                    {active
                        ? "A subscription link is active."
                        : "No active link."}
                </p>
            </div>
            <form action={formAction} className="flex flex-wrap gap-2">
                <input name="type" type="hidden" value={type} />
                <Button
                    type="submit"
                    name="action"
                    value="generate"
                    disabled={pending}
                    variant="outline"
                >
                    {active ? "Replace link" : "Create link"}
                </Button>
                {active ? (
                    <Button
                        type="submit"
                        name="action"
                        value="revoke"
                        disabled={pending}
                        variant="outline"
                    >
                        Revoke link
                    </Button>
                ) : null}
            </form>
            {active ? (
                <p className="text-muted-foreground text-xs">
                    Replacing or revoking this link stops existing subscriptions
                    from refreshing.
                </p>
            ) : null}
            <div aria-live="polite" className="grid gap-2">
                {state.error ? (
                    <p className="text-destructive text-sm" role="alert">
                        {state.error}
                    </p>
                ) : null}
                {state.message ? (
                    <p className="text-sm">{state.message}</p>
                ) : null}
                {state.url ? (
                    <>
                        <label
                            className="text-sm font-medium"
                            htmlFor={`calendar-${type}`}
                        >
                            Subscription URL
                        </label>
                        <input
                            id={`calendar-${type}`}
                            readOnly
                            value={state.url}
                            onFocus={(event) => event.currentTarget.select()}
                            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(
                                            state.url!,
                                        );
                                        setCopied(true);
                                    } catch {
                                        setCopied(false);
                                    }
                                }}
                            >
                                {copied ? "Copied" : "Copy link"}
                            </Button>
                            <a
                                className={buttonVariants()}
                                href={state.url.replace(/^https?:/, "webcal:")}
                            >
                                Subscribe on iPhone
                            </a>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}

export function CalendarSubscriptions({
    activeTypes,
}: {
    activeTypes: ("ALL" | "PERSONAL")[];
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Calendar subscriptions</CardTitle>
                <CardDescription>
                    Follow published schedules in your calendar. Anyone with a
                    link can read its calendar, so keep it private.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                    <Subscription
                        type="ALL"
                        active={activeTypes.includes("ALL")}
                    />
                    <Subscription
                        type="PERSONAL"
                        active={activeTypes.includes("PERSONAL")}
                    />
                </div>
                <p className="text-muted-foreground text-sm">
                    On iPhone, tap Subscribe on iPhone, or copy the URL and in
                    Calendar choose Calendars → Add Calendar → Add Subscription
                    Calendar. Calendar apps refresh on their own schedule, so
                    changes may take time to appear.
                </p>
            </CardContent>
        </Card>
    );
}
