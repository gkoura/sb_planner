// Retire an announcement by removing it from this list; use a new ID for each feature.
export const announcements = [
    {
        id: "call-out-logging-2026-10",
        title: "New: Call-out logging",
        description: "Record call-outs and export worked hours.",
        href: "/call-outs",
        linkLabel: "Go to call-outs",
    },
    {
        id: "calendar-subscriptions-2026-10",
        title: "New: Calendar subscriptions",
        description:
            "Subscribe to all standby dates or your own duties in your calendar.",
        href: "/schedules",
        linkLabel: "View subscriptions",
    },
] as const;
