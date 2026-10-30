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

export function DateTimePicker({
    name,
    label,
    defaultValue,
    disabled = false,
}: DateTimePickerProps) {
    const initialDate = React.useMemo(() => {
        if (!defaultValue) return undefined;

        const match = defaultValue.match(
            /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
        );

        if (!match) return undefined;

        const [, year, month, day] = match;

        const date = new Date(Number(year), Number(month) - 1, Number(day));

        if (
            date.getFullYear() !== Number(year) ||
            date.getMonth() !== Number(month) - 1 ||
            date.getDate() !== Number(day)
        ) {
            return undefined;
        }

        return date;
    }, [defaultValue]);

    const [date, setDate] = React.useState<Date | undefined>(initialDate);
    const [hour, setHour] = React.useState(
        defaultValue?.match(/T(\d{2}):/)?.[1] ?? "09",
    );
    const [minute, setMinute] = React.useState(
        defaultValue?.match(/:(\d{2})$/)?.[1] ?? "00",
    );
    const [open, setOpen] = React.useState(false);

    // Keep the original datetime-local form-data format.
    // Do not convert this value to UTC or ISO.
    const value = date ? `${format(date, "yyyy-MM-dd")}T${hour}:${minute}` : "";

    return (
        <div className="grid gap-1.5">
            <label htmlFor={`${name}-picker`} className="text-sm font-medium">
                {label}
            </label>

            <input type="hidden" name={name} value={value} />

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
                        onSelect={setDate}
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
                                onValueChange={(value) => {
                                    if (value !== null) setHour(value);
                                }}
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
                                onValueChange={(value) => {
                                    if (value !== null) setMinute(value);
                                }}
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
