<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SB Planner — persistent product plan

This file is the project’s living plan. Read it before making a product or
architecture change. At the end of every session, update the relevant
milestone, decisions, open questions, and verification notes. Do not silently
change a recorded decision: add a dated superseding decision with the reason.

## Product goal

SB Planner creates one monthly standby/on-call assignment per calendar day for
a small engineering team (maximum 10 people). Each engineer signs in and
submits the dates they are available or unavailable. Once everyone has
submitted, an administrator generates, reviews, and publishes the schedule.
Published schedules and the submitted availability that produced them remain
available as historical records.

The product must feel fast and intentionally small. It is a single team tool,
not a multi-tenant SaaS.

## Source behaviour to preserve from `../schedule_script/main.py`

The existing Python script is the behavioural reference for schedule generation:

- A schedule covers exactly one calendar month and assigns exactly one
  engineer to every day.
- An engineer may state either **available dates** or **unavailable dates**;
  the application normalizes both to an available-date set. An engineer with
  no restriction is available every day.
- A schedule is invalid when any day has no available engineer.
- No engineer may be assigned on consecutive calendar days.
- An engineer who is available for five or fewer dates is assigned on every
  date they are available (the current “mandatory availability” rule).
- Subject to the hard rules, assignments should be as evenly balanced as
  possible across engineers.
- The current script exports an Excel table and a colour-coded calendar PNG.
  These exports are useful reference material, not committed v1 scope.

Before changing any of these rules, write the new rule, why it changes, and
whether historical schedules keep the old semantics in the decision log.

## Confirmed architecture decisions

| Area | Decision | Reason |
| --- | --- | --- |
| Application | Next.js App Router + TypeScript, with server-side mutations and rendering where possible | One lightweight deployable application; minimal client JavaScript. |
| Data | Prisma ORM with SQLite semantics | Required practice goal and more than sufficient for at most 10 users and monthly history. |
| Hosted database | Use a hosted libSQL/SQLite-compatible provider (initial candidate: Turso) in production; use a local SQLite file in development | A local SQLite file is not durable on typical serverless deployments. Prisma supports SQLite/libSQL driver adapters. Validate the chosen provider’s then-current free-tier limits before launch. |
| Authentication | Better Auth + Prisma adapter, email/password only at first | Fits the requested practice goal without OAuth configuration or paid services. Account creation will be invite/admin controlled. |
| Auth UI | Better Auth UI components through its shadcn registry, with shadcn/ui as the general component foundation | Keeps ownership of copied UI code and avoids building routine auth screens. Pin and verify compatible versions during implementation. |
| Authorization | One application-level `ADMIN` role and `ENGINEER` role | Better Auth authenticates; our app authorizes. Do not add organizations or multi-tenancy in v1. |
| Schedule algorithm | Implement a small, pure TypeScript scheduling module inside this app | The problem is bounded (<= 10 engineers × <= 31 days), runs on demand, and needs no network or separate runtime. A pure module is easy to test and deploy. |
| No Python service | Do not create an external Python/OR-Tools service for v1 | It adds a second deployment, authentication boundary, observability surface, and non-zero hosting risk without a benefit at this scale. Reconsider only if future rules make the in-app solver demonstrably inadequate. |
| Deployment | Deploy the Next.js app to a free hosting tier compatible with the selected database and Better Auth; keep secrets in host environment variables | The exact host is intentionally deferred until dependencies and provider free tiers are checked at deployment time. |

### Algorithm approach

Do not port OR-Tools merely for parity. Build a deterministic TypeScript
constraint search/branch-and-bound solver with these characteristics:

1. Validate and normalize input before solving.
2. Assign constrained days first (fewest eligible engineers) and use a stable
   name/id tie-breaker, so identical input produces identical output.
3. Enforce hard constraints while searching: one assignee per day, submitted
   availability, no adjacent assignments, and mandatory availability.
4. Minimize a documented fairness score, initially the sum of absolute
   deviation from the ideal number of assignments, matching the Python
   script’s intent.
5. Return structured infeasibility explanations that the admin can act on;
   never publish a partial or invalid schedule.
6. Unit-test parity against representative fixtures derived from the Python
   script, including invalid and infeasible cases.

The first implementation must include an explicit search-state limit and a
clear failure result. At this input size it should complete well below a second;
measure it before considering a different solver.

## Initial data model

Use migrations from day one. IDs should be stable strings; record timestamps
on all mutable data.

- `User` / Better Auth tables: identity, session, account, verification as
  generated by Better Auth; extend user data with role and a display name.
- `PlanningMonth`: `id`, `year`, `month`, `status` (`DRAFT`, `COLLECTING`,
  `READY`, `GENERATED`, `PUBLISHED`), `createdBy`, timestamps.
- `PlanningMember`: a snapshot of each eligible user for that month. Do not
  infer past membership from the current user list.
- `AvailabilitySubmission`: one current submission per planning member;
  `mode` (`AVAILABLE` or `UNAVAILABLE`), `submittedAt`, `updatedAt`.
- `AvailabilityDate`: one row per selected date, unique per submission/date.
  Store full ISO dates, not day numbers, to prevent month ambiguity.
- `ScheduleRun`: immutable generation record with input/version metadata,
  generated time, and optional diagnostics. Keeping a run supports audit and
  future regeneration without losing history.
- `ScheduleAssignment`: immutable per-date assignment belonging to a run,
  unique per run/date.

Published schedules are immutable. A correction creates a new run/version;
the UI identifies which version is currently published. Availability is frozen
when an admin begins generation unless the admin explicitly reopens collection.

## v1 scope and user flow

1. Admin creates a month, selects eligible engineers, and opens collection.
2. Engineers sign in, view the active month, select one availability mode, and
   select dates on a calendar. They can save and revise until collection is
   closed.
3. The admin sees submission progress (submitted / total) but not an implied
   schedule before generation.
4. When all members submit, the admin generates a candidate schedule. The app
   validates constraints and shows assignments plus workload counts.
5. The admin publishes the candidate. Everyone can view the published calendar
   and prior months.

Keep v1 deliberately out of scope: recurring availability, swaps, reminders,
notifications/email delivery, public links, imports, exports, multiple teams,
and sophisticated preference weighting. Add one at a time only after a written
decision.

## Delivery milestones

- [ ] **M0 — Foundation:** inspect the current Next.js version guidance;
  initialize shadcn/ui; add Prisma, Better Auth, Better Auth UI, the local
  database, migrations, environment validation, and a seed path for the first
  admin. Confirm production provider and its current free-tier terms before
  adding credentials.
- [ ] **M1 — Identity and access:** implement invite/admin-controlled
  email/password authentication, admin/engineer authorization, login/logout,
  and protected routes. Do not expose public self-registration by default.
- [ ] **M2 — Month and availability:** implement admin month/member setup and
  engineer availability submission with server-side validation and timezone-free
  ISO calendar dates. Verify the complete save/revise flow.
- [ ] **M3 — Scheduler:** add the pure TypeScript solver, fixtures and unit
  tests for every source rule, candidate generation, constraint diagnostics,
  and admin review.
- [ ] **M4 — Publishing and history:** publish/version schedules, calendar and
  workload views, historical month navigation, and authorization tests.
- [ ] **M5 — Deploy and operate:** configure production database and secrets,
  migrate safely, deploy, create backups/export procedure, and test the
  production login → submit → generate → publish journey.

Do one milestone at a time. Before starting the next, update this plan with
what was built, tests run, deviations, and any new decision.

## Non-functional guardrails

- Optimize for server rendering and small client islands; do not introduce a
  global client-side state library unless a concrete feature needs it.
- Keep dependencies purposeful. Prefer built-in date APIs; consider a calendar
  library only if accessible month selection would otherwise become fragile.
- Validate all mutations on the server; an engineer can only read/write their
  own availability, and only admins can manage months or schedules.
- Never put database URLs or Better Auth secrets in source control. Required
  production variables include `DATABASE_URL`, `BETTER_AUTH_SECRET`, and
  `BETTER_AUTH_URL`.
- Back up/export the production database before schema migrations. “Free” tiers
  and deployment platforms can change; keeping a small recoverable export is
  part of the design.

## Decision log

| Date | Decision | Status / rationale |
| --- | --- | --- |
| 2026-10-25 | Keep scheduling inside the Next.js application as a pure TypeScript module. | Accepted. The bounded problem does not justify an external Python service. |
| 2026-10-25 | Use Prisma and SQLite semantics; choose hosted libSQL for production and local SQLite for development. | Accepted. A deployed serverless filesystem is not durable. Provider and exact adapter remain a deployment-time confirmation. |
| 2026-10-25 | Start with Better Auth email/password, admin-controlled accounts, Better Auth UI, and shadcn/ui. | Accepted. Smallest useful secure workflow; email delivery and OAuth are deferred. |
| 2026-10-25 | Treat the existing Python rules as v1 scheduling requirements. | Accepted. Any semantic adjustment requires a new decision entry and tests. |

## Open decisions (do not guess)

1. Who creates engineer accounts: admin-created temporary passwords, invitation
   emails, or a closed sign-up allowlist? This determines whether an email
   service is needed.
2. Does “all have submitted” strictly block generation, or may an admin
   explicitly generate early after recording an exception?
3. Are weekends/holidays weighted differently, and should fairness carry over
   from previous months? Current source behaviour treats every date equally and
   each month independently.
4. Should v1 include CSV/Excel or image export, or only the in-app calendar?
5. Which production host/database accounts are acceptable after current
   free-tier availability, data location, and backup requirements are checked?
