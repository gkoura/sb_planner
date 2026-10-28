export default function AppLoading() {
    return (
        <div
            aria-label="Loading your standby workspace"
            className="grid gap-8"
            role="status"
        >
            <section className="bg-primary text-primary-foreground rounded-3xl px-6 py-8 shadow-sm sm:px-9 sm:py-10">
                <p className="text-primary-foreground/80 text-sm font-medium">
                    SB Planner
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                    Your standby workspace
                </h1>
                <p className="text-primary-foreground/80 mt-3 max-w-xl text-sm leading-relaxed sm:text-base">
                    Loading your latest planning information…
                </p>
            </section>
            <section aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
                <div className="bg-muted h-24 animate-pulse rounded-2xl" />
                <div className="bg-muted h-24 animate-pulse rounded-2xl" />
            </section>
            <div
                aria-hidden="true"
                className="bg-muted h-52 animate-pulse rounded-2xl"
            />
        </div>
    );
}
