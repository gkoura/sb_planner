const zone = "Europe/Athens";
const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

export function athensParts(date: Date) {
    const parts = Object.fromEntries(
        formatter.formatToParts(date).map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Reject ambiguous and nonexistent wall times at daylight-saving transitions.
export function parseAthensDateTime(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
    const naive = Date.parse(`${value}:00Z`);
    if (!Number.isFinite(naive)) return null;
    const candidates = [2, 3]
        .map((offset) => new Date(naive - offset * 3600000))
        .filter((date) => athensParts(date) === value);
    return candidates.length === 1 ? candidates[0] : null;
}

export function dutyDate(start: Date, role?: string): string | null {
    if (role === "SUPPORT" || role === "OVERTIME") return null;
    const local = athensParts(start);
    if (local.slice(11) >= "09:00") return local.slice(0, 10);
    const previous = new Date(`${local.slice(0, 10)}T12:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    return previous.toISOString().slice(0, 10);
}

export function callOutDuration(start: Date, end: Date) {
    const minutes = (end.getTime() - start.getTime()) / 60000;
    return { minutes, roundedHours: Math.ceil(minutes / 60) };
}

export function callOutDailyHours(start: Date, end: Date) {
    const days: { date: string; minutes: number; hours: number }[] = [];
    const endTime = end.getTime();

    for (let cursor = start.getTime(); cursor < endTime;) {
        const date = athensParts(new Date(cursor)).slice(0, 10);
        const nextDate = new Date(`${date}T12:00:00Z`);
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        const midnight = parseAthensDateTime(
            `${nextDate.toISOString().slice(0, 10)}T00:00`,
        );
        if (!midnight) throw new Error("Unable to calculate Athens midnight");
        const until = Math.min(midnight.getTime(), endTime);
        const minutes = (until - cursor) / 60000;
        days.push({ date, minutes, hours: Math.floor(minutes / 60) });
        cursor = until;
    }

    const wholeHours = days.reduce((sum, day) => sum + day.hours, 0);
    const extraHours = callOutDuration(start, end).roundedHours - wholeHours;
    const partialDays = days
        .map((day) => {
            const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay();
            return {
                day,
                remainder: day.minutes % 60,
                weekend: weekday === 0 || weekday === 6,
            };
        })
        .filter(({ remainder }) => remainder > 0)
        .sort(
            (a, b) =>
                Number(b.weekend) - Number(a.weekend) ||
                b.remainder - a.remainder ||
                a.day.date.localeCompare(b.day.date),
        );
    for (const { day } of partialDays.slice(0, extraHours)) {
        day.hours++;
    }
    return days;
}
