export type HomeUser = {
    id: string;
    name: string;
    role: "ADMIN" | "ENGINEER";
};

export type TodayStandbyAssignment = {
    name: string;
    phoneNumber: string | null;
    planningMonthId: string;
};

export type PersonalDuty = {
    date: string;
    label: string;
};

export type PersonalSchedule = {
    planningMonthId: string;
    month: number;
    year: number;
    duties: PersonalDuty[];
};

export type AvailabilityOverviewMonth = {
    id: string;
    month: number;
    status: "COLLECTING" | "READY";
    submitted: boolean;
    year: number;
};

export type AdminOverviewMonth = {
    id: string;
    imported: boolean;
    memberCount: number;
    month: number;
    status: string;
    submissionCount: number;
    year: number;
};

export type AdminOverview = {
    engineerCount: number;
    recentMonths: AdminOverviewMonth[];
};

export type HomeData = {
    admin: AdminOverview | null;
    availabilityMonths: AvailabilityOverviewMonth[];
    personalSchedule: PersonalSchedule | null;
    todayAssignment: TodayStandbyAssignment | null;
};
