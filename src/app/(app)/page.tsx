import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AdminOverview } from "@/components/home/admin-overview";
import { AvailabilityOverview } from "@/components/home/availability-overview";
import { EmergencyContactCard } from "@/components/home/emergency-contact-card";
import { HomeHeader } from "@/components/home/home-header";
import { PersonalMonthReport } from "@/components/home/personal-month-report";
import { TodayStandbyCard } from "@/components/home/today-standby-card";
import { getCurrentSession } from "@/lib/auth-guard";
import { getTodayInAthens } from "@/lib/home/dates";
import { getHomeData } from "@/lib/home/queries";

export default function Home() {
    return (
        <Suspense fallback={<HomeFallback />}>
            <HomeContent />
        </Suspense>
    );
}

async function HomeContent() {
    const session = await getCurrentSession();
    if (!session) redirect("/sign-in");

    const today = getTodayInAthens();
    const data = await getHomeData(
        {
            id: session.user.id,
            name: session.user.name,
            role: session.user.role === "ADMIN" ? "ADMIN" : "ENGINEER",
        },
        today,
    );
    const availabilityNeeded = data.availabilityMonths.some(
        (month) => !month.submitted,
    );

    return (
        <div className="grid gap-8">
            <HomeHeader
                availabilityNeeded={availabilityNeeded}
                name={session.user.name}
            />
            <TodayStandbyCard assignment={data.todayAssignment} today={today} />
            <EmergencyContactCard />
            <PersonalMonthReport
                schedule={data.personalSchedule}
                today={today}
            />
            <AvailabilityOverview months={data.availabilityMonths} />
            {data.admin ? <AdminOverview data={data.admin} /> : null}
        </div>
    );
}

function HomeFallback() {
    return (
        <div
            aria-label="Loading planning overview"
            className="grid gap-8"
            role="status"
        >
            <section className="bg-primary text-primary-foreground rounded-3xl px-6 py-8 shadow-sm sm:px-9 sm:py-10">
                <p className="text-primary-foreground/80 text-sm font-medium">
                    SB Planner
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                    Your standby desk
                </h1>
                <p className="text-primary-foreground/80 mt-3 max-w-xl text-sm leading-relaxed sm:text-base">
                    Loading your planning overview…
                </p>
            </section>
            <section aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
                <div className="bg-muted h-24 animate-pulse rounded-2xl" />
                <div className="bg-muted h-24 animate-pulse rounded-2xl" />
            </section>
        </div>
    );
}
