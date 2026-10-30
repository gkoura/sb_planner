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

export function dutyDate(start: Date): string {
    const local = athensParts(start);
    if (local.slice(11) >= "09:00") return local.slice(0, 10);
    const previous = new Date(`${local.slice(0, 10)}T12:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    return previous.toISOString().slice(0, 10);
}

export function splitCallOut(start: Date, end: Date) {
    const result: { date: string; minutes: number; roundedHours: number }[] =
        [];
    let cursor = start.getTime();
    while (cursor < end.getTime()) {
        const date = athensParts(new Date(cursor)).slice(0, 10);
        const next = new Date(`${date}T12:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        const midnight = parseAthensDateTime(
            `${next.toISOString().slice(0, 10)}T00:00`,
        );
        if (!midnight) throw new Error("Unable to calculate Athens midnight");
        const until = Math.min(end.getTime(), midnight.getTime());
        const minutes = (until - cursor) / 60000;
        result.push({ date, minutes, roundedHours: Math.ceil(minutes / 60) });
        cursor = until;
    }
    return result;
}
