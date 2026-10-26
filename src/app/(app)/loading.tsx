export default function AppLoading() {
  return (
    <div
      aria-label="Loading your standby workspace"
      className="grid gap-8"
      role="status"
    >
      <section className="rounded-3xl bg-primary px-6 py-8 text-primary-foreground shadow-sm sm:px-9 sm:py-10">
        <p className="text-sm font-medium text-primary-foreground/80">
          SB Planner
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Your standby workspace
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
          Loading your latest planning information…
        </p>
      </section>
      <section aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      </section>
      <div
        aria-hidden="true"
        className="h-52 animate-pulse rounded-2xl bg-muted"
      />
    </div>
  );
}
