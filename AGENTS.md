<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## SB Planner — persistent product plan

This file is the project’s living plan. Read it before making a product or
architecture change. At the end of every session, update the relevant
milestone, decisions, open questions, and verification notes. Do not silently
change a recorded decision: add a dated superseding decision with the reason.

## Product goal

SB Planner is a lightweight team hub for a small engineering team (maximum 10
engineers), with monthly standby/on-call planning as its first core workflow.
Team members sign in to see who is on standby today, access the team's
published schedules, and take part in monthly planning. Each engineer submits
the dates they are available or unavailable. Once everyone has submitted, an
administrator generates, reviews, and publishes the schedule. Published
schedules and the submitted availability that produced them remain available
as historical records.

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

| Area               | Decision                                                                                                                                        | Reason                                                                                                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application        | Next.js App Router + TypeScript, with server-side mutations and rendering where possible                                                        | One lightweight deployable application; minimal client JavaScript.                                                                                                                                                      |
| Data               | Prisma ORM with PostgreSQL semantics                                                                                                           | Neon PostgreSQL will serve both local development and production. The app is small, but a durable managed database works cleanly with serverless hosting and Better Auth.                                                |
| Hosted database    | Neon Free PostgreSQL for development and production; Netlify Free for hosting                                                                  | The development branch is isolated from production. PostgreSQL data starts fresh at launch; no SQLite data is imported. Keep the database in Ohio to match the app's default function region.                          |
| Authentication     | Better Auth + Prisma adapter, email/password only at first                                                                                      | Fits the requested practice goal without OAuth configuration or paid services. Account creation will be invite/admin controlled.                                                                                        |
| Auth UI            | Better Auth UI components through its shadcn registry, with shadcn/ui as the general component foundation                                       | Keeps ownership of copied UI code and avoids building routine auth screens. Pin and verify compatible versions during implementation.                                                                                   |
| Authorization      | One application-level `ADMIN` role and `ENGINEER` role; multiple accounts may be admins                                                         | Better Auth authenticates; our app authorizes. Admin status grants team and schedule management, independent of someone's real-world team title. Keep one team only; do not add organizations or multi-tenancy.         |
| Schedule algorithm | Implement a small, pure TypeScript scheduling module inside this app                                                                            | The problem is bounded (<= 10 engineers × <= 31 days), runs on demand, and needs no network or separate runtime. A pure module is easy to test and deploy.                                                              |
| No Python service  | Do not create an external Python/OR-Tools service for v1                                                                                        | It adds a second deployment, authentication boundary, observability surface, and non-zero hosting risk without a benefit at this scale. Reconsider only if future rules make the in-app solver demonstrably inadequate. |
| Deployment         | Deploy the Next.js app to a free hosting tier compatible with the selected database and Better Auth; keep secrets in host environment variables | The exact host is intentionally deferred until dependencies and provider free tiers are checked at deployment time.                                                                                                     |

### Algorithm approach

Do not port OR-Tools merely for parity. Build a deterministic TypeScript
constraint search/branch-and-bound solver with these characteristics:

1. Validate and normalize input before solving.
2. Assign constrained days first (fewest eligible engineers) and use a stable
   name/id tie-breaker, so identical input produces identical output.
3. Enforce primary hard constraints while searching: one primary assignee per
   day, submitted availability, no adjacent primary assignments, and mandatory
   availability for participants with five or fewer available dates.
4. Minimize primary workload imbalance first, then place shadow duties with
   both participants available, no participant working consecutive dates, one
   shadow pair per date, and balanced mentor load. Prefer spread trainee days
   and distinct mentors when feasible.
5. Return structured infeasibility explanations that the admin can act on;
   never publish a partial or invalid schedule.
6. Unit-test parity against representative fixtures derived from the Python
   script and shadowing cases, including invalid and infeasible inputs.

The first implementation must include an explicit search-state limit and a
clear failure result. At this input size it should complete well below a second;
measure it before considering a different solver.

## Initial data model

Use migrations from day one. IDs should be stable strings; record timestamps
on all mutable data.

- `User` / Better Auth tables: identity, session, account, verification as
  generated by Better Auth; extend user data with role, display name, and an
  optional international-format phone number. Email remains the sign-in
  identifier and is not self-editable until a verification flow exists.
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

## Shadowing requirements (accepted; implementation in progress)

Participation mode is selected per engineer per planning month, so onboarding
is not tied to a fixed first-month/second-month workflow:

- `NORMAL`: the existing primary on-call participation.
- `TRAINEE`: no primary days; the admin sets a shadow-day count. The scheduler
  spreads those shadow days through the month and rotates across mentors,
  avoiding repeat mentors when possible.
- `MENTORED`: the engineer has primary on-call days, with a senior mentor as a
  second participant on each of those days. The mentor cannot also be primary
  on that date, and mentor shadow work counts toward workload fairness.

Mentor candidates default to all other non-trainee members in that month's
rotation. Trainee and mentor availability are both hard constraints. Primary
assignments are balanced first; then shadow duties are spread fairly among
eligible mentors. A shadow duty counts as a work day for the no-consecutive
rule, and any conflict makes generation fail rather than creating a warning.
Each shadow date contains one pair only: one trainee and one mentor. Do not
schedule a second shadow pair on the same date, even with another mentor.

The existing one-primary-assignee-per-day schedule remains. Shadowing adds a
second assignment layer on selected dates; it does not change historical runs.
Store shadow assignments as separate records attached to a primary date,
allowing multiple trainees in a month without changing the one-primary-per-day
constraint. Snapshot participation settings with each schedule run so editing
and restoring historical versions uses the original rules. Admin primary-day
edits regenerate shadow pairings; published past shadow pairings stay locked
unless the admin enables past-date corrections. Restoring a version copies its
saved pairings.

## UI/UX direction

- Keep the app focused and calm: warm neutral page surfaces, deep teal primary
  actions, Geist typography, clear status labels, and comfortable spacing.
- Keep navigation and primary actions reachable on mobile. Use the existing
  shadcn components and Tailwind tokens; do not add a UI dependency without a
  concrete need.
- The signed-in home page is the team hub: prominently show today's on-standby
  person from the current published schedule, the date in Europe/Athens, and a
  link to that schedule. If no published assignment exists for today, say so
  clearly. Show the same team-wide on-call information to admins and engineers.
- Show each signed-in participant's own assigned days for the current month,
  with the next upcoming assignment highlighted by date and a link to the full
  team schedule. Do not put the full schedule calendar on the home page.
- Availability entry is a fixed, accessible month calendar with every day
  defaulting to available. Each day toggles green/available ↔ red/unavailable;
  the form persists the unavailable dates as date-only ISO values.
- Schedule review uses a Monday-first monthly calendar. Each participant gets
  a distinct pastel/ink color inspired by the Python export, with a name and
  workload legend so color is never the only identifier. Shadow pairings are
  labeled in the day cell; participant totals include primary and shadow duties.
  On narrow screens the calendar uses initials and the legend keeps full names
  visible.

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

Keep v1 deliberately out of scope: recurring availability, reminders,
notifications/email delivery, public links, multiple teams, and sophisticated
preference weighting. Schedule import and schedule exports are implemented for
the single team.

## Schedule import (implemented 2026-10-28)

The admin should be able to import an externally prepared schedule for past,
current, or future months. If the month already has a published schedule, the
import should become the current schedule while preserving the previous version
in history.

The admin creates the planning month and its roster, then imports through its
admin month page. The import page supports past, current, and future calendar
months. Its downloadable template has one row per date and these exact columns:
`date,primary_email,shadow_email,shadow_kind`. Dates use `YYYY-MM-DD`; a shadow
is optional and its kind is `TRAINING` or `MENTORING`. Participant email must
match an email snapshot in that month's roster (case-insensitive). The feature
does not add members or accounts implicitly. A month-specific preview displays
the calendar and primary workload before a save.

Malformed CSV, incorrect or missing dates, duplicates, unknown participants,
invalid shadow pairs, shadow-mode/count mismatches, unavailable shadow
participants, and consecutive work days involving a shadow are blocking errors,
preserving the confirmed shadowing constraints. Primary availability and
primary-only consecutive-day violations are shown as warnings and require an
admin reason. If a participant has no availability submission, that absence is
recorded in the run snapshot and availability cannot be inferred, so no
availability warning is produced for them. A first import becomes a generated
candidate and uses the existing publish action. Importing into a published
month creates and publishes the next immutable `ScheduleRun` version while
retaining prior versions. It requires a reason; edits to past operational dates
also require an explicit confirmation. The current human-facing CSV export is
not a round-trip format because shadow details are combined into display text.

This import-specific validation preserves the confirmed shadowing constraints
for both generated and manually imported schedules. Primary-only exceptions
follow the existing manual schedule-edit warning-and-reason workflow.

No new package is required. The server rechecks authorization, roster, month
state, current run, CSV structure, and schedule rules before writing. Preview
state becomes invalid if the month status or current run changes.

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
      account form, admin-managed role changes for existing accounts, and an
      idempotent first-admin seed command are implemented.
      Public self-registration remains disabled. **Verified 2026-10-25:** static
      type checking and local migration checks pass; the first-admin flow still
      needs browser verification after credentials are seeded. **Role management
      added 2026-10-26:** admins can promote engineers or revoke another admin's
      status; an admin cannot change their own role or remove the last admin.
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
      flow still needs browser verification. **Admin submission visibility
      (2026-10-28):** each participant row on `/admin/months` displays a clear
      `Submitted` or `Not submitted` badge alongside the existing total, so the
      admin can see exactly who has responded. **Availability confirmation
      (2026-10-28):** submitted availability has a prominent saved-state callout;
      the action reads `Modify availability` for existing submissions and uses
      a general saved confirmation for first submissions and updates.
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
- [ ] **M3 extension — Shadow participation:** add per-month normal, trainee,
      and mentored settings; a shadow-aware scheduler; schedule display and exports;
      and version-safe admin editing/restoration. **Progress (2026-10-26):** added
      `ParticipationMode`, trainee shadow counts, and `ScheduleShadow`; applied the
      SQLite migration locally and regenerated Prisma Client. Admins can configure
      modes before generation. Generation keeps primary fairness separate, spreads
      trainee days, rotates mentors, and enforces availability, one shadow pair per
      date, and no consecutive work days. Calendars, personal month reports, and
      exports show shadow duties. Admin edits regenerate pairings, and historical
      restores retain saved pairings. TypeScript, ESLint, `git diff --check`, and
      drawio XML validation pass. Scheduler-specific tests and browser review remain
      pending.
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
      Published schedules can be copied as Markdown or downloaded as a color-coded
      PNG calendar or CSV assignment list; these exports are generated client-side
      without adding a package.
      Shadow names and duty types are included in the calendar and exports; the
      legend counts both primary and shadow duties.
- [ ] **M5 — Deploy and operate:** configure production database and secrets,
      migrate safely, deploy, create backups/export procedure, and test the
      production login → submit → generate → publish journey. **Planning update
      (2026-10-27):** Netlify Free and Neon Free are the deployment targets.
      Production will start with an empty PostgreSQL database; local schedule data
      will not be copied. Use Neon AWS US East (Ohio) (`aws-us-east-2`) to match
      Netlify Free's default function region. The first admin will be created with
      a one-time, server-side seed command after production migrations are applied.
      **Progress (2026-10-27):** Neon development branch created; PostgreSQL
      adapter packages installed. Prisma now uses PostgreSQL through `@prisma/adapter-pg`,
      Better Auth is configured for PostgreSQL, and the admin seed script uses
      the same adapter. A fresh PostgreSQL baseline is maintained in
      `prisma/migrations-postgresql`; the original SQLite migrations and local
      database remain available as development history but are no longer active.
      Prisma CLI prefers `DIRECT_URL` for migrations and falls back to
      `DATABASE_URL`; the app uses `DATABASE_URL` at runtime. Apply and verify the
      baseline on the Neon development branch before preparing the production
      environment. **Applied (2026-10-27):** the PostgreSQL baseline was applied
      to the configured Neon development branch with `prisma migrate deploy`; a
      second deploy confirmed there are no pending migrations. Prisma schema
      validation, client generation, TypeScript checking, and `git diff --check`
      pass. Production branch setup and Netlify environment configuration remain.
      **Development admin seeded (2026-10-27):** the configured initial admin
      account was created in the Neon development database with the idempotent
      `scripts/seed-admin.mjs` command. Production needs its own one-time seed
      after production migrations are applied.
      **Build readiness (2026-10-27):** the user reports `pnpm run build`
      succeeds locally with the PostgreSQL configuration. Next: push the
      database-switch branch to GitHub, connect Netlify, and configure
      production-only environment variables before applying production schema.
- [x] **M6 — Account settings:** signed-in members can edit their display name
      and optional phone number, admins can set the optional number when creating
      an engineer, and members can change their password using Better Auth.
      **Completed (2026-10-26):** phone values are normalized and validated in
      international E.164 form; email remains read-only because no email
      verification flow is configured. Phone numbers are shown only to
      authenticated team members as a callable number on today's standby card and
      in the published/admin schedule participant legend and schedule exports.
      Password changes require the current password and revoke other sessions. The
      SQLite migration was applied and Prisma Client regenerated; TypeScript and
      ESLint pass. Browser review remains pending.

**UI/UX progress (2026-10-26):** added a role-aware home dashboard, responsive
navigation, a calmer color system, a fixed-month availability calendar, and a
color-coded schedule calendar with workload legend. TypeScript and ESLint pass;
visual browser review remains pending.

**Team hub home page (2026-10-26):** both admins and engineers see today's
on-standby person at the top of the signed-in home page, sourced from the
current published schedule. The date is resolved in Europe/Athens to match the
schedule's operational timezone. If no published assignment exists, the card
states that directly; when an assignment exists it links to its schedule.

**Current month overview (2026-10-26):** revised the home page overview to a
personal report: each member sees their own standby dates for the current
published month, with their next upcoming day highlighted. The full team
calendar remains one click away on the schedule page. If the current month is
not published, the report explains that.

**Availability home CTA (2026-10-26):** show the home page's availability
action only when the signed-in participant has at least one open month without
a submission. Label it "Submit availability"; hide it when no submission is
needed. The Availability navigation remains available for optional revisions.

**Homepage architecture (2026-10-28):** the signed-in homepage now has one
server-rendered composition for every role: welcome, today’s standby, personal
month report, availability overview, then the admin overview when authorized.
The homepage only authenticates and composes sections; `lib/home/queries.ts`
owns Prisma reads and view-data shaping, `lib/home/types.ts` defines the
presentation contracts, and `components/home/` owns each section. An admin
who is a planning member now receives the same personal schedule and
availability overview as an engineer. Removed the misleading three-item
"Recent planning months" metric and the hard-coded `/ 10` denominator; the
admin overview shows the actual engineer-account count and recent-month list.
Verified 2026-10-28: TypeScript, focused homepage lint, scheduler tests,
`git diff --check`, and `next build --webpack` pass. Full-repository ESLint is
currently blocked by four pre-existing React Compiler hook warnings in Better
Auth UI components outside this refactor; browser verification remains pending.

**Account settings (2026-10-26):** `/account` allows a member to update their
display name and optional phone number; admins can also set the optional phone
number when creating an engineer. Email remains read-only until a verification
flow exists. Phone numbers are stored as normalized E.164 values
and displayed only to signed-in team members on the home page's today card and
schedule participant legends, with `tel:` links; schedule exports include
primary and shadow/mentor contacts when present. Existing planning member and
schedule name snapshots remain unchanged after a profile name edit. The
password form uses Better Auth's `changePassword` endpoint with the current
password and revokes other sessions after a successful change. The DB migration
and type/lint checks pass; browser review is pending.

- [x] **M7 — External schedule import:** admins can download a month-specific
      CSV template, upload and preview a complete schedule, see schedule warnings
      and primary workload, and save the result as a candidate or a published
      replacement version. The format uses exact roster email snapshots and
      includes optional training/mentoring shadows. Historical versions remain
      immutable; published imports require a reason and explicit confirmation
      when changing past dates. **Implemented (2026-10-28):** added the import
      route, client preview/confirmation flow, and server-side validation and
      transaction. TypeScript, ESLint, and `git diff --check` pass; production
      compilation and route generation pass with `next build --webpack`. The
      default Turbopack build is blocked in this environment when its CSS worker
      tries to bind a port. **Import write refinement (2026-10-28):** after a
      runtime foreign-key failure in the nested create path, the transaction
      now creates the run first and writes assignments and shadows using its
      returned ID. TypeScript, ESLint, and diff checks pass; verify this write
      against the development database on the next import. Browser review
      remains outstanding.

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

**App icon (2026-10-28):** use Lucide's `CalendarDays` mark as the favicon via
the Next.js `src/app/icon.svg` convention, with the app's deep teal and white
colors. Remove the starter `favicon.ico` so it cannot compete with the SVG icon.

**Theme toggle affordance (2026-10-28):** keep the pointer cursor on the dark
mode icon button so it visibly communicates that it can be clicked.

**Imported-month submission labels (2026-10-28):** for months whose latest
schedule run is a CSV import, show that availability was not collected instead
of a misleading zero submission count. Keep ordinary submission counts and
progress indicators for algorithm-generated months.

**CSV template download affordance (2026-10-28):** show a pointer cursor on the
month-specific template download button to make its click action apparent.

**CSV file chooser affordance (2026-10-28):** style the native accessible file
input as an outline button with an upload icon, matching the template action;
the full button surface opens the picker, the selected filename replaces the
prompt, and keyboard focus is visible. Clear the native input value after
selection so the same file can be chosen again.

**Engineer creation form (2026-10-28):** split optional phone entry into a
country calling-code selector (default Greece, +30) and national-number field;
submit their normalized combination through the existing E.164 validation.
Allow admins to reveal or hide the temporary password with an accessible
control.

**Account phone editor (2026-10-28):** reuse the same country-code and local
number control in account settings, prefilled by splitting the saved E.164
number. Preserve an existing number unchanged if its calling code is not in the
selector list until the member chooses a replacement.

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

**Month deletion (2026-10-26):** admins may delete only `DRAFT` months that
have no schedule run history. Show a confirmation before deleting. Keep
submitted months and published schedule history intact.

**Route streaming fix (2026-10-26):** the authenticated layout's session gate
still triggered the Next.js insight with a boundary inside that layout, so a
deterministic visible `<Suspense>` fallback now also wraps route children inside
the root document body. The home page retains its dashboard fallback for its
own dynamic content. The `(app)/loading.tsx` convention now provides a
meaningful segment fallback around the other authenticated pages' data reads,
so each route can stream the static app shell during instant navigation.
Link-style Base UI buttons set `nativeButton={false}` so they retain anchor
semantics without development warnings. TypeScript, ESLint, and
`git diff --check` pass. Browser reload/visual verification is pending: the
in-app browser bridge is not trusted and the requested skill is not present in
the available skill directories. The prior production build was blocked by
inability to fetch Geist fonts from Google Fonts.

**pnpm agent skill linking (2026-10-27):** pnpm 12's approved package skills
are linked into `.agents/skills`, configured through `skills.dirs` in
`pnpm-workspace.yaml`. The directory ignores generated `pnpm-*` links.

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

| Date       | Decision                                                                                                                                                                       | Status / rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-25 | Keep scheduling inside the Next.js application as a pure TypeScript module.                                                                                                    | Accepted. The bounded problem does not justify an external Python service.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-10-25 | Use Prisma and SQLite semantics; choose hosted libSQL for production and local SQLite for development.                                                                         | Superseded 2026-10-27 by the Neon PostgreSQL decision. This describes the initial implementation; its SQLite schema, local database, and migration history remain archived for reference, but are not the active app database.                                                                                                                                                                                                                                                                                    |
| 2026-10-25 | Start with Better Auth email/password, admin-controlled accounts, Better Auth UI, and shadcn/ui.                                                                               | Accepted. Smallest useful secure workflow; email delivery and OAuth are deferred.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-25 | Treat the existing Python rules as v1 scheduling requirements.                                                                                                                 | Accepted. Any semantic adjustment requires a new decision entry and tests.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-10-25 | Use Better Auth’s standard Prisma tables with a `User.role` string defaulting to `ENGINEER`; sign-up is disabled.                                                              | Accepted. The first admin and future engineers will be provisioned by an admin in M1.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-10-25 | Bootstrap the first administrator through an idempotent local seed command, then create engineer credentials from an admin-only server action.                                 | Accepted. It avoids public registration and does not require email delivery in v1.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-10-26 | An administrator may opt into a month as a scheduler participant.                                                                                                              | Accepted. Planning membership is independent of the account's `ADMIN` role and does not consume one of the 10 engineer slots.                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-26 | Permit one planning month per calendar month and create it as `DRAFT`.                                                                                                         | Accepted. This prevents duplicate monthly plans; the later availability step will define when collection opens.                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-26 | Admins explicitly open collection; all participants must submit before a month reaches `READY`.                                                                                | Accepted. The status gives the admin a clear readiness signal for generation. Submissions remain editable through `READY` until generation begins; generation will only accept fully submitted months.                                                                                                                                                                                                                                                                                                      |
| 2026-10-26 | Store availability as one replaceable submission per planning member, with a mode and full ISO calendar-date strings.                                                          | Accepted. The selected dates mean either the complete available-date set or the unavailable-date set, matching the Python script's normalization rule while keeping date-only values timezone safe.                                                                                                                                                                                                                                                                                                         |
| 2026-10-26 | Generate schedules in the Next.js app with a deterministic TypeScript constraint search that preserves the Python rules.                                                       | Accepted. At most 11 participants including an optional admin and 31 dates fit a bounded in-process search; an external Python service adds deployment and operational cost. Stop after 250,000 states with a clear failure instead of saving a non-optimal or invalid candidate.                                                                                                                                                                                                                           |
| 2026-10-26 | Only generate from `READY`; save each candidate as a versioned run with an input snapshot and freeze availability at generation.                                               | Accepted. This ensures the saved assignments can be audited against the exact submissions used, and publishing remains a separate admin decision in M4.                                                                                                                                                                                                                                                                                                                                                     |
| 2026-10-26 | Use the existing DayPicker component for availability selection and a color-coded month grid for schedule review.                                                              | Accepted. The availability picker provides familiar keyboard-accessible date selection; the read-only schedule grid supports at-a-glance scanning and follows the Python calendar palette, with a text legend for accessibility.                                                                                                                                                                                                                                                                            |
| 2026-10-26 | Availability calendar days default to available and toggle green/red when clicked.                                                                                             | Accepted. Persist the compact unavailable-date set using the existing `UNAVAILABLE` submission mode; translate prior `AVAILABLE`-mode submissions to the same day-by-day state when loading them for editing.                                                                                                                                                                                                                                                                                               |
| 2026-10-26 | Start availability and schedule calendars on Monday.                                                                                                                           | Accepted. This matches the team's weekday-first reading preference; schedule grid offsets and weekday labels follow the same ordering.                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-26 | Use dark green for available calendar days and dark red for unavailable days.                                                                                                  | Accepted. Both states use white text and remain high-contrast in light and dark themes.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-10-26 | Drive availability day colors from the calendar button's selected modifier.                                                                                                    | Accepted. React Day Picker v10 exposes the selected state on the day cell, not `aria-pressed` on the button; the custom day button now mirrors that modifier as `data-selected`.                                                                                                                                                                                                                                                                                                                            |
| 2026-10-26 | Use `next-themes` with shadcn light/dark tokens, system default, and a persistent manual toggle.                                                                               | Accepted. Use the existing dependency; expose the toggle on authenticated app pages and sign-in, and prevent initial hydration mismatch on the root element.                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-26 | Edit assignments through a targeted day editor and an explicit two-day swap; persist every edit as a versioned revision.                                                       | Accepted. Preserve generated and published history, enforce availability/no-consecutive/mandatory rules, recalculate fairness, and allow published past-date corrections only with an explicit override and required reason.                                                                                                                                                                                                                                                                                |
| 2026-10-26 | Allow manual schedule exceptions with visible validation warnings and a required reason.                                                                                       | Accepted. The solver continues to enforce its rules for generated schedules; admin-edited assignments may override availability, consecutive-day, or mandatory-availability warnings. Save the warnings and reason with the new immutable revision for audit.                                                                                                                                                                                                                                               |
| 2026-10-26 | Preview historical versions and restore them as a new version.                                                                                                                 | Accepted. Keep prior versions immutable; restoring creates a new linked candidate or published version, requires a reason, and applies the past-date correction safeguard.                                                                                                                                                                                                                                                                                                                                  |
| 2026-10-26 | Mark the official schedule version with `ScheduleRun.publishedAt`; show published months to all signed-in team members.                                                        | Accepted. Publication is one transaction that selects the official run and marks the month `PUBLISHED`; the immutable generation snapshot remains available for history.                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-26 | Keep each run's `publishedAt` as its first publication timestamp; latest timestamp identifies the current official version.                                                    | Accepted. This preserves the fact and time that older revisions were official while still making one version current.                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-10-26 | Use warm neutral surfaces, deep teal actions, and compact role-aware navigation.                                                                                               | Accepted. It gives the small operations tool a distinct visual identity while keeping screens calm, readable, and responsive without additional dependencies.                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-26 | Allow admins to delete only draft months with no schedule run history.                                                                                                         | Accepted. Confirmation protects against accidental removal; submitted availability and published schedule history remain preserved.                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-10-26 | Offer Markdown copy, PNG calendar, and CSV exports for published schedules.                                                                                                    | Accepted. Generate the exports client-side from the published run and existing participant palette, avoiding an additional dependency or server workload.                                                                                                                                                                                                                                                                                                                                                   |
| 2026-10-26 | Position the app as a team hub, with today's published standby assignment prominent on the signed-in home page for every role.                                                 | Accepted and implemented. The current on-call person is a high-priority team-wide status; the date follows Europe/Athens and links to the official schedule.                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-26 | Show the complete current month's published standby calendar on the signed-in home page.                                                                                       | Accepted and implemented. Reuse the existing color-coded Monday-first calendar and workload legend, with a link to the official schedule and an unpublished empty state.                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-26 | Replace the homepage's full month calendar with a user-specific report of that member's shifts; highlight their next upcoming day and keep the whole schedule behind a button. | Accepted; supersedes the previous homepage full-calendar decision after usability review. This lets each person find their own dates immediately without scanning the team calendar.                                                                                                                                                                                                                                                                                                                        |
| 2026-10-26 | Show the homepage availability action only while a participant still owes a submission.                                                                                        | Accepted and implemented. Once all open months have a submission, remove the redundant call to action; availability remains reachable for optional revisions.                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-26 | Configure participation per engineer per month as normal, trainee (shadow-only, admin-configured count), or mentored (primary shifts with a second mentor).                    | Accepted. All other non-trainee participants form the default mentor pool. Both trainee and mentor must be available; shadows count as work for the hard no-consecutive-days rule. Balance primary assignments separately, then distribute mentor duties fairly; avoid repeating a trainee's mentor where possible. Each date may contain at most one shadow pair. Store shadows separately from one-primary-per-day assignments and snapshot settings per run; historical runs retain their old semantics. |
| 2026-10-26 | Add account settings for display name, optional phone, and password; keep email read-only until verification is available.                                                     | Accepted. Store phone on Better Auth's User row in normalized E.164 format; it is unverified and visible only to authenticated team members on today's standby card and schedule participant legends. Existing planning history keeps name snapshots; future planning months use the updated account name. Password changes use Better Auth's current-password check and revoke other sessions.                                                                                                             |
| 2026-10-26 | Allow admins to provide an optional engineer phone number at account creation.                                                                                                 | Accepted. Use the same normalized international format and server validation as member profile edits, storing the value in `User.phoneNumber`; a member can add or correct it later from account settings.                                                                                                                                                                                                                                                                                                  |
| 2026-10-26 | Include current phone contacts in all three schedule export formats.                                                                                                           | Accepted, extending the existing Markdown, PNG, and CSV export decision. Include primary and shadow/mentor phone numbers when available; omit an absent number. Do not export email addresses or other account fields.                                                                                                                                                                                                                                                                                      |
| 2026-10-26 | Allow multiple admins in this single-team app; admin access is an app permission, not the team-lead title.                                                                     | Accepted. An admin can promote engineers and revoke another admin's access. Prevent self-demotion and removal of the last remaining admin; appoint a replacement admin before a planned departure. This lets a trusted scheduler manage plans without needing to be the real-world team lead. Sudden loss of every admin remains deferred.                                                                                                                                                                  |
| 2026-10-26 | Try Netlify Free for hosting; deploy with a fresh production database and do not copy local schedule data.                                                                     | Accepted. Production starts empty; no current data import is needed.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-27 | Use Neon Free PostgreSQL with Netlify Free for the initial deployment.                                                                                                         | Accepted. Select AWS US East (Ohio), `aws-us-east-2`, to match Netlify Free's default function region and avoid cross-region database calls. Apply a fresh PostgreSQL migration baseline, then create the first admin with a one-time seed command.                                                                                                                                                                                                                                                         |
| 2026-10-27 | Move the active Prisma provider from SQLite to PostgreSQL, using separate migration histories.                                                                                  | Accepted and implemented on `db_migrate`. Neon development and production use separate branches/URLs. The SQLite database and its migrations are retained but inactive; production receives no imported data. Prisma CLI uses `DIRECT_URL` when configured, while the application and seed script use pooled `DATABASE_URL`.                                                                                                                                                                            |

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
5. **Resolved:** initial deployment uses Netlify Free + Neon Free PostgreSQL;
   production starts empty. Apply a new PostgreSQL migration baseline, with no
   import from the local SQLite database.
6. How should the team recover access if every admin becomes inaccessible?
   Intentionally deferred until later; the current safeguard is to keep at least
   one admin and support multiple admins.
7. Schedule import is requested. Confirm the proposed CSV template, roster
   mapping, and validation/override behavior before implementation.

<!-- NEXT-AGENTS-MD-START -->[Next.js Docs Index]|root: ./node_modules/next/dist/docs|STOP. What you remember about Next.js is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command from this file's directory: npx @next/codemod agents-md --output AGENTS.md|01-app:{04-glossary.md}|01-app/01-getting-started:{01-installation.md,02-project-structure.md,03-layouts-and-pages.md,04-linking-and-navigating.md,05-server-and-client-components.md,06-fetching-data.md,07-mutating-data.md,08-caching.md,09-revalidating.md,10-error-handling.md,11-css.md,12-images.md,13-fonts.md,14-metadata-and-og-images.md,15-route-handlers.md,16-proxy.md,17-deploying.md,18-upgrading.md}|01-app/02-guides:{adopting-partial-prefetching.md,ai-agents.md,analytics.md,authentication-with-cache-components.md,authentication.md,backend-for-frontend.md,building.md,caching-without-cache-components.md,cdn-caching.md,ci-build-caching.md,content-security-policy.md,css-in-js.md,custom-server.md,data-security.md,debugging.md,deploying-to-platforms.md,draft-mode.md,environment-variables.md,forms.md,how-revalidation-works.md,incremental-static-regeneration-cache-components.md,incremental-static-regeneration.md,instant-navigation.md,instrumentation.md,interactive-apps.md,internationalization.md,json-ld.md,keeping-pages-static.md,lazy-loading.md,local-development.md,mcp.md,mdx.md,memory-usage.md,migrating-to-cache-components.md,multi-tenant.md,multi-zones.md,offline-support.md,open-telemetry.md,optimizing-prefetching.md,optimizing-the-static-shell.md,package-bundling.md,ppr-platform-guide.md,prefetching.md,preserving-ui-state.md,preventing-flash-before-hydration.md,production-checklist.md,progressive-web-apps.md,public-static-pages.md,redirecting.md,rendering-philosophy.md,sass.md,scripts.md,self-hosting.md,server-actions.md,server-and-client-boundary.md,single-page-applications.md,static-exports.md,streaming.md,tailwind-v3-css.md,third-party-libraries.md,videos.md,view-transitions.md}|01-app/02-guides/client-side-data-fetching:{swr.md,tanstack-query.md}|01-app/02-guides/migrating:{app-router-migration.md,from-create-react-app.md,from-vite.md}|01-app/02-guides/testing:{cypress.md,jest.md,playwright.md,vitest.md}|01-app/02-guides/upgrading:{agent-upgrade.md,codemods.md,version-14.md,version-15.md,version-16.md}|01-app/03-api-reference:{07-edge.md,08-turbopack.md}|01-app/03-api-reference/01-directives:{use-cache-private.md,use-cache-remote.md,use-cache.md,use-client.md,use-server.md}|01-app/03-api-reference/02-components:{font.md,form.md,image.md,link.md,script.md}|01-app/03-api-reference/03-file-conventions/01-metadata:{app-icons.md,manifest.md,opengraph-image.md,robots.md,sitemap.md}|01-app/03-api-reference/03-file-conventions/02-route-segment-config:{dynamicParams.md,ensureStatic.md,instant.md,maxDuration.md,preferredRegion.md,prefetch.md,runtime.md}|01-app/03-api-reference/03-file-conventions:{default.md,dynamic-routes.md,error.md,forbidden.md,instrumentation-client.md,instrumentation.md,intercepting-routes.md,layout.md,loading.md,mdx-components.md,middleware.md,not-found.md,page.md,parallel-routes.md,proxy.md,public-folder.md,route-groups.md,route.md,src-folder.md,template.md,unauthorized.md}|01-app/03-api-reference/04-functions:{after.md,cacheLife.md,cacheTag.md,catchError.md,connection.md,cookies.md,draft-mode.md,fetch.md,forbidden.md,generate-image-metadata.md,generate-metadata.md,generate-sitemaps.md,generate-static-params.md,generate-viewport.md,headers.md,image-response.md,io.md,navigation.md,next-request.md,next-response.md,next-root-params.md,not-found.md,permanentRedirect.md,prefetch.md,redirect.md,refresh.md,revalidatePath.md,revalidateTag.md,unauthorized.md,unstable_cache.md,unstable_noStore.md,unstable_rethrow.md,updateTag.md,use-link-status.md,use-offline.md,use-params.md,use-pathname.md,use-report-web-vitals.md,use-router.md,use-search-params.md,use-selected-layout-segment.md,use-selected-layout-segments.md,userAgent.md}|01-app/03-api-reference/05-config/01-next-config-js:{adapterPath.md,agentFeedback.md,agentRules.md,agentUpgrade.md,allowedDevOrigins.md,appDir.md,assetPrefix.md,authInterrupts.md,basePath.md,cacheComponents.md,cacheHandlers.md,cacheLife.md,cacheMaxMemorySize.md,compress.md,crossOrigin.md,cssChunking.md,deploymentId.md,devIndicators.md,distDir.md,enablePrerenderSourceMaps.md,env.md,expireTime.md,exportPathMap.md,exposeTestingApiInProductionBuild.md,generateBuildId.md,generateEtags.md,headers.md,htmlLimitedBots.md,httpAgentOptions.md,images.md,incrementalCacheHandlerPath.md,inlineCss.md,instrumentationClientInject.md,logging.md,mdxRs.md,onDemandEntries.md,optimizePackageImports.md,output.md,outputHashSalt.md,pageExtensions.md,partialPrefetching.md,poweredByHeader.md,prefetchInlining.md,productionBrowserSourceMaps.md,proxyClientMaxBodySize.md,reactCompiler.md,reactMaxHeadersLength.md,reactStrictMode.md,redirects.md,rewrites.md,sassOptions.md,serverActions.md,serverComponentsHmrCache.md,serverExternalPackages.md,skipProxyUrlNormalize.md,skipTrailingSlashRedirect.md,staleTimes.md,staticGeneration.md,supportsImmutableAssets.md,taint.md,trailingSlash.md,transpilePackages.md,turbopack.md,turbopackChunking.md,turbopackFileSystemCache.md,turbopackGc.md,turbopackIgnoreIssue.md,turbopackLazyDynamicImports.md,turbopackLazyDynamicImportsSSR.md,turbopackLocalPostcssConfig.md,turbopackMemoryEviction.md,turbopackPluginRuntimeStrategy.md,turbopackRustReactCompiler.md,typedRoutes.md,typescript.md,urlImports.md,useLightningcss.md,useOffline.md,useTypeScriptCli.md,webVitalsAttribution.md,webpack.md}|01-app/03-api-reference/05-config:{02-typescript.md,03-eslint.md}|01-app/03-api-reference/06-cli:{create-next-app.md,next.md}|01-app/03-api-reference/07-adapters:{01-configuration.md,02-creating-an-adapter.md,03-api-reference.md,04-testing-adapters.md,05-routing-with-next-routing.md,06-implementing-ppr-in-an-adapter.md,07-runtime-integration.md,08-invoking-entrypoints.md,09-output-types.md,10-routing-information.md,11-use-cases.md,12-immutable-static-assets.md}|02-pages/01-getting-started:{01-installation.md,02-project-structure.md,04-images.md,05-fonts.md,06-css.md,11-deploying.md}|02-pages/02-guides:{analytics.md,authentication.md,babel.md,ci-build-caching.md,content-security-policy.md,css-in-js.md,custom-server.md,debugging.md,draft-mode.md,environment-variables.md,forms.md,incremental-static-regeneration.md,instrumentation.md,internationalization.md,lazy-loading.md,mdx.md,multi-zones.md,open-telemetry.md,package-bundling.md,post-css.md,preview-mode.md,production-checklist.md,redirecting.md,sass.md,scripts.md,self-hosting.md,static-exports.md,tailwind-v3-css.md,third-party-libraries.md}|02-pages/02-guides/migrating:{app-router-migration.md,from-create-react-app.md,from-vite.md}|02-pages/02-guides/testing:{cypress.md,jest.md,playwright.md,vitest.md}|02-pages/02-guides/upgrading:{codemods.md,version-10.md,version-11.md,version-12.md,version-13.md,version-14.md,version-15.md,version-16.md,version-9.md}|02-pages/03-building-your-application/01-routing:{01-pages-and-layouts.md,02-dynamic-routes.md,03-linking-and-navigating.md,05-custom-app.md,06-custom-document.md,07-api-routes.md,08-custom-error.md}|02-pages/03-building-your-application/02-rendering:{01-server-side-rendering.md,02-static-site-generation.md,04-automatic-static-optimization.md,05-client-side-rendering.md}|02-pages/03-building-your-application/03-data-fetching:{01-get-static-props.md,02-get-static-paths.md,03-get-server-side-props.md,05-client-side.md}|02-pages/03-building-your-application/06-configuring:{12-error-handling.md}|02-pages/04-api-reference:{06-edge.md,08-turbopack.md}|02-pages/04-api-reference/01-components:{font.md,form.md,head.md,image-legacy.md,image.md,link.md,script.md}|02-pages/04-api-reference/02-file-conventions:{instrumentation.md,proxy.md,public-folder.md,src-folder.md}|02-pages/04-api-reference/03-functions:{catchError.md,get-initial-props.md,get-server-side-props.md,get-static-paths.md,get-static-props.md,next-request.md,next-response.md,use-params.md,use-report-web-vitals.md,use-router.md,use-search-params.md,userAgent.md}|02-pages/04-api-reference/04-config/01-next-config-js:{adapterPath.md,allowedDevOrigins.md,assetPrefix.md,basePath.md,bundlePagesRouterDependencies.md,compress.md,crossOrigin.md,deploymentId.md,devIndicators.md,distDir.md,enablePrerenderSourceMaps.md,env.md,exportPathMap.md,generateBuildId.md,generateEtags.md,headers.md,httpAgentOptions.md,images.md,logging.md,onDemandEntries.md,optimizePackageImports.md,output.md,pageExtensions.md,poweredByHeader.md,productionBrowserSourceMaps.md,proxyClientMaxBodySize.md,reactStrictMode.md,redirects.md,rewrites.md,serverExternalPackages.md,skipProxyUrlNormalize.md,skipTrailingSlashRedirect.md,trailingSlash.md,transpilePackages.md,turbopack.md,turbopackChunking.md,typescript.md,urlImports.md,useLightningcss.md,useTypeScriptCli.md,webVitalsAttribution.md,webpack.md}|02-pages/04-api-reference/04-config:{01-typescript.md,02-eslint.md}|02-pages/04-api-reference/05-cli:{create-next-app.md,next.md}|02-pages/04-api-reference/06-adapters:{01-configuration.md,02-creating-an-adapter.md,03-api-reference.md,04-testing-adapters.md,05-routing-with-next-routing.md,06-runtime-integration.md,07-invoking-entrypoints.md,08-output-types.md,09-routing-information.md,10-use-cases.md}|03-architecture:{accessibility.md,fast-refresh.md,nextjs-compiler.md,supported-browsers.md}|04-community:{01-contribution-guide.md,02-rspack.md}<!-- NEXT-AGENTS-MD-END -->
