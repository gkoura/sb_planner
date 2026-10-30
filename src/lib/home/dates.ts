import { utcCalendarDate } from "@/lib/calendar-date";
export function formatMonth(year: number, month: number) {
    return new Intl.DateTimeFormat("en", {
        month: "long",
        timeZone: "UTC",
        year: "numeric",
    }).format(utcCalendarDate(year, month, 1));
}

export function getTodayInAthens(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "Europe/Athens",
        year: "numeric",
    }).formatToParts(now);
    const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
}

export function formatScheduleDate(date: string) {
    return new Intl.DateTimeFormat("en", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));
}

export function daysFromToday(date: string, today: string) {
    return Math.round(
        (new Date(`${date}T00:00:00Z`).getTime() -
            new Date(`${today}T00:00:00Z`).getTime()) /
            86_400_000,
    );
}
