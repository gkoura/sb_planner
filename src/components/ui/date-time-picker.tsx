"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarDays, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DateTimePickerProps = {
    name: string;
    label: string;
    defaultValue?: string;
    disabled?: boolean;
};

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

const minutes = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, "0"),
);

const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function parseLocalDateTime(value?: string): Date | undefined {
    if (!value) return undefined;

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

    if (!match) return undefined;

    const [, year, month, day, hour, minute] = match;

    const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
    );

    if (
        date.getFullYear() !== Number(year) ||
        date.getMonth() !== Number(month) - 1 ||
        date.getDate() !== Number(day) ||
        date.getHours() !== Number(hour) ||
        date.getMinutes() !== Number(minute)
    ) {
        return undefined;
    }

    return date;
}

function getDefaultDateTime(name: string): Date {
    const now = new Date();

    // Round upwards to the next full hour.
    const end = new Date(now);

    end.setHours(
        end.getHours() +
            (end.getMinutes() > 0 ||
            end.getSeconds() > 0 ||
            end.getMilliseconds() > 0
                ? 1
                : 0),
        0,
        0,
        0,
    );

    // Start is exactly one hour before end.
    if (name === "start") {
        return new Date(end.getTime() - 60 * 60 * 1000);
    }

    return end;
}

export function DateTimePicker({
    name,
    label,
    defaultValue,
    disabled = false,
}: DateTimePickerProps) {
    const isClient = React.useSyncExternalStore(
        subscribeToNothing,
        getClientSnapshot,
        getServerSnapshot,
    );
    const [dateTime, setDateTime] = React.useState<Date | undefined>(
        () =>
            parseLocalDateTime(defaultValue) ??
            (!defaultValue ? getDefaultDateTime(name) : undefined),
    );

    const [open, setOpen] = React.useState(false);

    // Keep dynamic defaults out of server-rendered output.
    const visibleDateTime = isClient ? dateTime : parseLocalDateTime(defaultValue);

    const date = visibleDateTime;

    const hour = date
        ? String(date.getHours()).padStart(2, "0")
        : "00";

    const minute = date
        ? String(date.getMinutes()).padStart(2, "0")
        : "00";

    // Preserve the datetime-local format without UTC conversion.
    const value = date ? format(date, "yyyy-MM-dd'T'HH:mm") : "";

    function handleDateChange(selectedDate: Date | undefined) {
        if (!selectedDate) return;

        setDateTime((previous) => {
            const updated = new Date(selectedDate);

            updated.setHours(
                previous?.getHours() ?? 0,
                previous?.getMinutes() ?? 0,
                0,
                0,
            );

            return updated;
        });
    }

    function handleHourChange(value: string | null) {
        if (value === null) return;

        setDateTime((previous) => {
            if (!previous) return previous;

            const updated = new Date(previous);
            updated.setHours(Number(value));

            return updated;
        });
    }

    function handleMinuteChange(value: string | null) {
        if (value === null) return;

        setDateTime((previous) => {
            if (!previous) return previous;

            const updated = new Date(previous);
            updated.setMinutes(Number(value));

            return updated;
        });
    }

    return (
        <div className="grid gap-1.5">
            <label htmlFor={`${name}-picker`} className="text-sm font-medium">
                {label}
            </label>

            <input
                type="hidden"
                name={name}
                value={value}
                disabled={disabled}
            />

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                    id={`${name}-picker`}
                    disabled={disabled}
                    aria-label={`Choose ${label.toLowerCase()} date and time`}
                    aria-required="true"
                    className={cn(
                        "border-input bg-background hover:bg-accent hover:text-accent-foreground",
                        "inline-flex h-9 w-full items-center justify-start rounded-md border px-4 py-2",
                        "text-left text-sm font-medium transition-colors",
                        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                        "disabled:pointer-events-none disabled:opacity-50",
                        !date && "text-muted-foreground",
                    )}
                >
                    <CalendarDays className="mr-2 size-4" />

                    {date
                        ? `${format(date, "dd MMM yyyy")} · ${hour}:${minute}`
                        : "Select date and time"}
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={handleDateChange}
                        defaultMonth={date}
                        autoFocus
                    />

                    <div className="border-t p-3">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                            <Clock3 className="size-4" />
                            Time (24-hour)
                        </div>

                        <div className="flex items-center gap-2">
                            <Select
                                value={hour}
                                onValueChange={handleHourChange}
                            >
                                <SelectTrigger
                                    aria-label={`${label} hour`}
                                    className="w-24"
                                >
                                    <SelectValue placeholder="Hour" />
                                </SelectTrigger>

                                <SelectContent>
                                    {hours.map((h) => (
                                        <SelectItem key={h} value={h}>
                                            {h}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <span className="font-semibold">:</span>

                            <Select
                                value={minute}
                                onValueChange={handleMinuteChange}
                            >
                                <SelectTrigger
                                    aria-label={`${label} minute`}
                                    className="w-24"
                                >
                                    <SelectValue placeholder="Minute" />
                                </SelectTrigger>

                                <SelectContent>
                                    {minutes.map((m) => (
                                        <SelectItem key={m} value={m}>
                                            {m}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            type="button"
                            className="mt-4 w-full"
                            disabled={!date}
                            onClick={() => setOpen(false)}
                        >
                            Done
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
