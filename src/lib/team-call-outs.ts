import type { Prisma } from "@prisma/client";
import { athensParts } from "@/lib/call-outs";

export type TeamCallOutFilters = { userId?: string; month?: string };

export function parseTeamCallOutFilters(params: {
    userId?: string | string[];
    month?: string | string[];
}): { filters: TeamCallOutFilters; error?: string } {
    if (typeof params.userId !== "string" && params.userId !== undefined)
        return { filters: {}, error: "Choose one team member." };
    if (
        params.month !== undefined &&
        params.month !== "" &&
        (typeof params.month !== "string" ||
            !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(params.month))
    )
        return { filters: {}, error: "Use a month in YYYY-MM format." };
    return {
        filters: {
            userId: params.userId || undefined,
            month: params.month || undefined,
        },
    };
}

export function teamCallOutWhere(
    filters: TeamCallOutFilters,
): Prisma.CallOutWhereInput {
    return filters.userId ? { userId: filters.userId } : {};
}

// Match the personal log's Athens start-month grouping, including overnight entries.
export function filterCallOutMonth<T extends { startedAt: Date }>(
    entries: T[],
    month?: string,
) {
    return month
        ? entries.filter(
              (entry) => athensParts(entry.startedAt).slice(0, 7) === month,
          )
        : entries;
}

export function teamCallOutExportUrl(filters: TeamCallOutFilters) {
    const params = new URLSearchParams();
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.month) params.set("month", filters.month);
    return `/api/admin/call-outs/export${params.size ? `?${params}` : ""}`;
}
