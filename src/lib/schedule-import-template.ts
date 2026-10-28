import { calendarDateValue, daysInCalendarMonth } from "@/lib/calendar-date";

export function makeScheduleImportTemplate(year: number, month: number) {
    const rows = ["date,primary_email,shadow_email,shadow_kind"];
    for (let day = 1; day <= daysInCalendarMonth(year, month); day += 1) {
        rows.push(`${calendarDateValue(year, month, day)},,,`);
    }
    return rows.join("\r\n");
}
