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
  `READY`, `GENERATED`, `PUBLISHED`), `createdBy`, timestamps. There is one
  planning month per year/month; new months start in `DRAFT`.
- `PlanningMember`: a snapshot of each eligible user for that month. Do not
  infer past membership from the current user list. An `ADMIN` may be included
  as a planning member for an individual month when they choose to participate;
  app role and planning participation are separate concepts.
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

## UI/UX direction

- Keep the app focused and calm: warm neutral page surfaces, deep teal primary
  actions, Geist typography, clear status labels, and comfortable spacing.
- Keep navigation and primary actions reachable on mobile. Use the existing
  shadcn components and Tailwind tokens; do not add a UI dependency without a
  concrete need.
- Availability entry is a fixed, accessible month calendar with every day
  defaulting to available. Each day toggles green/available ↔ red/unavailable;
  the form persists the unavailable dates as date-only ISO values.
- Schedule review uses a Monday-first monthly calendar. Each participant gets
  a distinct pastel/ink color inspired by the Python export, with a name and
  workload legend so color is never the only identifier. On narrow screens the
  calendar uses initials and the legend keeps full names visible.

## v1 scope and user flow

1. Admin creates a month, selects eligible engineers and may opt themselves
   into that month's rotation, then opens collection. Admin participation is
   optional and does not count toward the maximum of 10 engineer accounts.
2. Engineers sign in, view the active month, and toggle unavailable dates on a
   calendar. They can save and revise until collection is closed.
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
  admin. **Progress (2026-10-25):** shadcn/ui and Better Auth UI are installed;
  Prisma 7.10.1, Better Auth, a local SQLite database, its initial migration,
  the server/client auth configuration, and the first-admin seed path are in
  place. The seed script now imports its dotenv dependency explicitly.
  **Verified 2026-10-25:** script syntax and ESLint pass; invoking the seed with
  empty credentials loads `.env.local` and stops at the expected validation
  before database access. Environment validation remains; confirm production
  provider and its current free-tier terms before adding credentials.
- [x] **M1 — Identity and access:** email/password sign-in/sign-out, protected
  app routes, `ADMIN`/`ENGINEER` authorization, an administrator-only engineer
  account form, and an idempotent first-admin seed command are implemented.
  Public self-registration remains disabled. **Verified 2026-10-25:** static
  type checking and local migration checks pass; the first-admin flow still
  needs browser verification after credentials are seeded.
- [x] **M2 — Month and availability:** implement admin month/member setup and
  engineer availability submission with server-side validation and timezone-free
  ISO calendar dates. **Progress (2026-10-26):** admin month creation and
  participant snapshots are implemented; the admin can opt into a month.
  Months are unique per year/month and start as drafts. Prisma Client
  regeneration is automated with `postinstall` so schema updates do not leave
  model delegates missing. Admins can open collection for a draft month.
  Participants submit either selected available dates or selected unavailable
  dates using ISO date strings; each participant has one replaceable submission.
  A month becomes `READY` when all participants have submitted and returns to
  `COLLECTING` if a submission is later removed by future admin tooling.
  Participants may revise while status is `COLLECTING` or `READY`; schedule
  generation will freeze changes. **Applied 2026-10-26:** the availability
  migration was applied to the local SQLite database and Prisma Client was
  regenerated. Static TypeScript checking passes. Manual sign-in and submission
  flow still needs browser verification.
- [x] **M3 — Scheduler:** add the pure TypeScript solver, fixtures and unit
  tests for every source rule, candidate generation, constraint diagnostics,
  and admin review. **Progress (2026-10-26):** implemented deterministic
  TypeScript candidate generation, READY-only admin generation, immutable
  versioned run/input snapshots, and an assignment/workload review page. The
  solver follows the Python hard constraints and fairness objective, returns
  structured infeasibility/search-limit errors, and caps search at 250,000
  states. Schedule run and assignment migrations are applied locally and the
  Prisma Client is regenerated. **Completed (2026-10-26):** added Node built-in
  tests backed by fixtures for available/unavailable normalization, leap-year
  February, five-day mandatory availability, conflicting mandatory days,
  uncovered days, 31-day fairness optimum, deterministic ordering, consecutive
  day rules, and invalid input handling. All eight tests pass without adding a
  test dependency.
- [ ] **M4 — Publishing and history:** publish/version schedules, calendar and
  workload views, historical month navigation, and authorization tests.
  **Progress (2026-10-26):** admins can publish a complete generated version;
  each run records `publishedAt`, and publication atomically marks the chosen
  run as official and the month `PUBLISHED`. Authenticated team members can
  browse the published schedule archive and open a color-coded monthly view.
  Admins can revise a generated candidate or publish an edit as a new linked
  version. Reassignment and two-day swaps preserve hard constraints and refresh
  fairness/workload; published past dates require an explicit correction
  override and reason. `basedOnRunId` and `revisionReason` retain edit lineage,
  and prior `publishedAt` timestamps remain intact. The SQLite migration is
  applied and Prisma Client regenerated. TypeScript, ESLint, and diff checks
  pass; editor tests and browser review remain outstanding. Authorization tests
  also remain outstanding. The reassignment Select maps stable participant IDs
  to their snapshot names for the visible label. The save control explains when
  it is disabled because there is no staged change, a conflict, or a missing
  published-change reason. Manual hard-rule violations now display as warnings;
  any exception requires a reason, and the warning/reason are stored on the
  revision and shown to admins and on the published schedule.
  Version history supports read-only previews and restoration as a new version;
  restore operations require a reason and honor published past-date safeguards.
- [ ] **M5 — Deploy and operate:** configure production database and secrets,
  migrate safely, deploy, create backups/export procedure, and test the
  production login → submit → generate → publish journey.

**UI/UX progress (2026-10-26):** added a role-aware home dashboard, responsive
navigation, a calmer color system, a fixed-month availability calendar, and a
color-coded schedule calendar with workload legend. TypeScript and ESLint pass;
visual browser review remains pending.

**Availability calendar update (2026-10-26):** every day now starts green and
available; tapping toggles that date red/unavailable and tapping again restores
green/available. The UI always submits the unavailable-date set, which matches
the scheduler's existing normalization and converts older available-date
submissions into the equivalent unavailable set when editing. Counts and a
"Mark all days available" control make the state easy to review. Calendar day
states use dark green with white text for available and dark red with white text
for unavailable in both light and dark themes. Selected state is exposed on the
day button itself as `data-selected`, matching DayPicker's modifier state so
the per-state colors apply reliably.

**Theme support (2026-10-26):** shadcn semantic color tokens have light and dark
values. `next-themes` applies the `.dark` class from the saved user choice or
system preference; a shared toggle appears in the app header and sign-in page.
The default follows the operating system and user overrides persist locally.

**Schedule editing plan (2026-10-26):** admins edit a generated candidate before
publishing or save a new published revision afterward. The editor supports
single-day reassignment and explicit two-day swaps; it never cascades changes
to other dates. Hard-rule violations appear as warnings during manual edits;
admins may save an exception only with a required reason, and the warning is
stored with the revision. Workload/fairness are recalculated. Published past days are locked by default; an explicit
correction override is available with a required change reason. Each edit
creates a version linked to its source run, and a published edit becomes the
new official version while prior run publication timestamps remain in history.
The most recently published version is current. The current and historical
dates use the app's operational timezone, Europe/Athens.

Do one milestone at a time. Before starting the next, update this plan with
what was built, tests run, deviations, and any new decision.

**Scheduler test command:** `node --experimental-strip-types
--experimental-default-type=module --test tests/scheduler.test.mjs` (Node 22
built-in test runner with TypeScript stripping; no test package install
required). The same command is exposed as `pnpm run test:scheduler`; direct
Node invocation is the verified path because `pnpm run` stalled silently in
this environment.

## Architecture artifacts

- [Database schema diagram](docs/database-schema.drawio): editable diagrams.net
  ER diagram generated from the Prisma models. Update it when models or
  relations change; it documents each table, keys/indexes, and relationships.

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
| 2026-10-25 | Use Better Auth’s standard Prisma tables with a `User.role` string defaulting to `ENGINEER`; sign-up is disabled. | Accepted. The first admin and future engineers will be provisioned by an admin in M1. |
| 2026-10-25 | Bootstrap the first administrator through an idempotent local seed command, then create engineer credentials from an admin-only server action. | Accepted. It avoids public registration and does not require email delivery in v1. |
| 2026-10-26 | An administrator may opt into a month as a scheduler participant. | Accepted. Planning membership is independent of the account's `ADMIN` role and does not consume one of the 10 engineer slots. |
| 2026-10-26 | Permit one planning month per calendar month and create it as `DRAFT`. | Accepted. This prevents duplicate monthly plans; the later availability step will define when collection opens. |
| 2026-10-26 | Admins explicitly open collection; all participants must submit before a month reaches `READY`. | Accepted. The status gives the admin a clear readiness signal for generation. Submissions remain editable through `READY` until generation begins; generation will only accept fully submitted months. |
| 2026-10-26 | Store availability as one replaceable submission per planning member, with a mode and full ISO calendar-date strings. | Accepted. The selected dates mean either the complete available-date set or the unavailable-date set, matching the Python script's normalization rule while keeping date-only values timezone safe. |
| 2026-10-26 | Generate schedules in the Next.js app with a deterministic TypeScript constraint search that preserves the Python rules. | Accepted. At most 11 participants including an optional admin and 31 dates fit a bounded in-process search; an external Python service adds deployment and operational cost. Stop after 250,000 states with a clear failure instead of saving a non-optimal or invalid candidate. |
| 2026-10-26 | Only generate from `READY`; save each candidate as a versioned run with an input snapshot and freeze availability at generation. | Accepted. This ensures the saved assignments can be audited against the exact submissions used, and publishing remains a separate admin decision in M4. |
| 2026-10-26 | Use the existing DayPicker component for availability selection and a color-coded month grid for schedule review. | Accepted. The availability picker provides familiar keyboard-accessible date selection; the read-only schedule grid supports at-a-glance scanning and follows the Python calendar palette, with a text legend for accessibility. |
| 2026-10-26 | Availability calendar days default to available and toggle green/red when clicked. | Accepted. Persist the compact unavailable-date set using the existing `UNAVAILABLE` submission mode; translate prior `AVAILABLE`-mode submissions to the same day-by-day state when loading them for editing. |
| 2026-10-26 | Start availability and schedule calendars on Monday. | Accepted. This matches the team's weekday-first reading preference; schedule grid offsets and weekday labels follow the same ordering. |
| 2026-10-26 | Use dark green for available calendar days and dark red for unavailable days. | Accepted. Both states use white text and remain high-contrast in light and dark themes. |
| 2026-10-26 | Drive availability day colors from the calendar button's selected modifier. | Accepted. React Day Picker v10 exposes the selected state on the day cell, not `aria-pressed` on the button; the custom day button now mirrors that modifier as `data-selected`. |
| 2026-10-26 | Use `next-themes` with shadcn light/dark tokens, system default, and a persistent manual toggle. | Accepted. Use the existing dependency; expose the toggle on authenticated app pages and sign-in, and prevent initial hydration mismatch on the root element. |
| 2026-10-26 | Edit assignments through a targeted day editor and an explicit two-day swap; persist every edit as a versioned revision. | Accepted. Preserve generated and published history, enforce availability/no-consecutive/mandatory rules, recalculate fairness, and allow published past-date corrections only with an explicit override and required reason. |
| 2026-10-26 | Allow manual schedule exceptions with visible validation warnings and a required reason. | Accepted. The solver continues to enforce its rules for generated schedules; admin-edited assignments may override availability, consecutive-day, or mandatory-availability warnings. Save the warnings and reason with the new immutable revision for audit. |
| 2026-10-26 | Preview historical versions and restore them as a new version. | Accepted. Keep prior versions immutable; restoring creates a new linked candidate or published version, requires a reason, and applies the past-date correction safeguard. |
| 2026-10-26 | Mark the official schedule version with `ScheduleRun.publishedAt`; show published months to all signed-in team members. | Accepted. Publication is one transaction that selects the official run and marks the month `PUBLISHED`; the immutable generation snapshot remains available for history. |
| 2026-10-26 | Keep each run's `publishedAt` as its first publication timestamp; latest timestamp identifies the current official version. | Accepted. This preserves the fact and time that older revisions were official while still making one version current. |
| 2026-10-26 | Use warm neutral surfaces, deep teal actions, and compact role-aware navigation. | Accepted. It gives the small operations tool a distinct visual identity while keeping screens calm, readable, and responsive without additional dependencies. |

## Open decisions (do not guess)

1. Who creates engineer accounts: admin-created temporary passwords, invitation
   emails, or a closed sign-up allowlist? This determines whether an email
   service is needed.
2. **Resolved:** generation is blocked until all planning members have
   submitted; early generation exceptions are not in v1.
3. Are weekends/holidays weighted differently, and should fairness carry over
   from previous months? Current source behaviour treats every date equally and
   each month independently.
4. Should v1 include CSV/Excel or image export, or only the in-app calendar?
5. Which production host/database accounts are acceptable after current
   free-tier availability, data location, and backup requirements are checked?
