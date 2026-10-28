/** Gregorian month length for the date-only planning calendar. */
export function daysInCalendarMonth(year: number, month: number) {
    if (month === 2) {
        return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)
            ? 29
            : 28;
    }
    return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function calendarDateValue(year: number, month: number, day: number) {
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Avoid Date's 1900 offset for years 0–99 when creating a local calendar date. */
export function localCalendarDate(year: number, month: number, day: number) {
    const date = new Date(0);
    date.setHours(0, 0, 0, 0);
    date.setFullYear(year, month - 1, day);
    return date;
}

export function utcCalendarDate(year: number, month: number, day: number) {
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(0, 0, 0, 0);
    return date;
}
