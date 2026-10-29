"use client";

import { useState } from "react";

import { AvailabilityForm } from "@/components/availability/availability-form";
import { Button } from "@/components/ui/button";

type SavedAvailabilityProps = {
    checkedDates: string[];
    mode: "AVAILABLE" | "UNAVAILABLE";
    planningMonthId: string;
    month: number;
    year: number;
};

export function SavedAvailability(props: SavedAvailabilityProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="grid gap-5">
            <Button
                className="w-fit"
                type="button"
                variant="outline"
                aria-expanded={isOpen}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? "Hide availability" : "View availability"}
            </Button>
            {isOpen ? <AvailabilityForm {...props} hasSubmitted /> : null}
        </div>
    );
}
