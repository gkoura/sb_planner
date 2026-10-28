# SB Planner

SB Planner is a small, private team hub for planning a monthly standby (on-call)
rotation. It is built for one engineering team—not as a
multi-tenant SaaS product.

Team members sign in to see who is on standby today, submit their availability,
and review published schedules. Administrators create planning months, choose
participants, generate or import schedules, review them, and publish an
immutable version for the team. A monthly roster currently supports up to 10
engineers plus an optional participating admin.

## What it does

- Shows the published on-call person for today in the `Europe/Athens` operational timezone.
- Lets participants submit and revise monthly availability until collection closes.
- Generates a deterministic, balanced monthly schedule from availability.
- Prevents unavailable, uncovered, or consecutive primary standby assignments.
- Supports trainee shadowing and mentored primary participation.
- Lets administrators review, edit, publish, restore, and export versioned schedules.
- Supports validated CSV schedule imports for past, current, and future months.
- Keeps historical schedule versions and their assignment snapshots available for audit.

## Roles

| Role     | Capabilities                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Engineer | View published schedules, submit availability for months they join, and view their own assigned days.                                                              |
| Admin    | All engineer capabilities when participating in a month, plus user management, planning-month setup, schedule generation/import, review, editing, and publication. |

There is no public self-registration. An administrator creates engineer
accounts, and the initial administrator is created with the seed command.

## Schedule rules

Each schedule covers exactly one calendar month and assigns one primary person
per day. The scheduler normalizes either available-date or unavailable-date
submissions and applies these hard rules:

- Every date must have an eligible primary participant.
- A participant cannot have primary standby on consecutive calendar days.
- A participant available on five or fewer dates is assigned on every one of
  those dates.
- Primary workload is balanced as evenly as the constraints allow.
- Shadow and mentoring duties also require availability and cannot create
  consecutive work days.

Administrators can make deliberate manual exceptions during an edit, but the
application records the warning and required reason on the resulting immutable
version.

## CSV schedule imports

Admins can import a complete month using a downloaded template with these
columns:

```text
date,primary_email,shadow_email,shadow_kind
```

Dates use `YYYY-MM-DD`; shadows are optional and use `TRAINING` or `MENTORING`.
Roster emails must match the planning-month snapshot. The import is validated
before preview and again before saving. Saving stores an immutable schedule
version and its assignments—not the original uploaded CSV file. A first import
creates a candidate to publish; importing into an already published month
creates and publishes a new version while retaining the old version in history.

## Technology

- Next.js App Router and TypeScript
- PostgreSQL with Prisma and the Prisma PostgreSQL adapter
- Better Auth with email/password authentication
- Tailwind CSS, shadcn/ui, and Lucide icons

## Run locally

### Prerequisites

- Node.js 22 or newer
- pnpm 12
- A PostgreSQL database (the project is configured for Neon PostgreSQL)

### Install and configure

```bash
pnpm install
```

Create `.env.local` with your own values. Do not commit this file or any
credentials.

```dotenv
DATABASE_URL="postgresql://..."
# Optional but recommended for Prisma migrations when your provider has a direct URL.
DIRECT_URL="postgresql://..."
BETTER_AUTH_SECRET="a-long-random-secret"
BETTER_AUTH_URL="http://localhost:3000"

INITIAL_ADMIN_NAME="First Admin"
INITIAL_ADMIN_EMAIL="admin@example.com"
INITIAL_ADMIN_PASSWORD="choose-a-strong-password"
```

Apply the PostgreSQL migrations, seed the first administrator, then start the
development server:

```bash
pnpm exec prisma migrate deploy
pnpm seed:admin
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), then sign in with the
seeded administrator account. The seed command is idempotent: if the email
already exists, it promotes that account to `ADMIN` without changing its
password.

## Useful commands

```bash
pnpm dev                              # Start the development server
pnpm exec prisma migrate deploy        # Apply PostgreSQL migrations
pnpm seed:admin                       # Create or promote the initial administrator
pnpm test                             # Run scheduling and authorization tests
pnpm test:scheduler                   # Run scheduling-rule tests
pnpm test:integration                 # Run isolated PostgreSQL concurrency tests
pnpm lint                             # Run ESLint
pnpm format:check                     # Check formatting
pnpm build                            # Create a production build
```

The integration tests require a disposable local PostgreSQL database named
`sb_planner_rel001_test`, with the PostgreSQL migrations applied. Set
`SB_TEST_DATABASE_URL` to that database before running `pnpm test:integration`.
The tests create records in it; they reject remote hosts and other database
names. Never point them at the development or production database.

If a default build environment has Turbopack worker-port limitations, use the
webpack build explicitly:

```bash
pnpm exec next build --webpack
```

## Project layout

```text
src/app/                 Routes, server actions, and App Router layouts
src/components/          UI components and feature-specific forms
src/lib/                 Authentication, Prisma, scheduling, import, and date logic
prisma/                  Prisma schema and PostgreSQL migrations
tests/                   Scheduler fixtures and rule tests
scripts/                 Operational scripts, including first-admin seeding
```

## Deployment notes

The intended hosted setup is Neon PostgreSQL with a hosting provider that can
run the Next.js application. Configure production environment variables in the
hosting provider, apply migrations to the production database, and run the
first-admin seed command against that database once. Production starts with an
empty database; local schedule data is not copied automatically.

Before a production schema migration, create a database backup or export.
