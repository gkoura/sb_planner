export type CalendarCell = { day: number; date: string } | null;

export function buildMonthWeeks(year: number, month: number): CalendarCell[][] {
    const leapYear = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
    const totalDays =
        month === 2
            ? leapYear
                ? 29
                : 28
            : [4, 6, 9, 11].includes(month)
              ? 30
              : 31;
    const firstDate = new Date(0);
    firstDate.setUTCFullYear(year, month - 1, 1);
    firstDate.setUTCHours(0, 0, 0, 0);
    const firstWeekday = (firstDate.getUTCDay() + 6) % 7;
    const cells: CalendarCell[] = [
        ...Array<null>(firstWeekday).fill(null),
        ...Array.from({ length: totalDays }, (_, index) => {
            const day = index + 1;
            return {
                day,
                date: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
            };
        }),
    ];

    const weeks: CalendarCell[][] = [];
    for (let index = 0; index < cells.length; index += 7) {
        weeks.push(cells.slice(index, index + 7));
    }
    const lastWeek = weeks[weeks.length - 1];
    if (lastWeek.length !== 7) {
        lastWeek.push(...Array<null>(7 - lastWeek.length).fill(null));
    }
    return weeks;
}
