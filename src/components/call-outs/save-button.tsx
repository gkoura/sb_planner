"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SaveCallOutButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Saving call-out…" : "Save call-out"}
        </Button>
    );
}
