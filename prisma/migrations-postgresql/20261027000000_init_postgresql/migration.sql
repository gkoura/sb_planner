-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlanningStatus" AS ENUM ('DRAFT', 'COLLECTING', 'READY', 'GENERATED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AvailabilityMode" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "ParticipationMode" AS ENUM ('NORMAL', 'TRAINEE', 'MENTORED');

-- CreateEnum
CREATE TYPE "ShadowKind" AS ENUM ('TRAINING', 'MENTORING');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ENGINEER',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningMonth" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PlanningStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningMember" (
    "id" TEXT NOT NULL,
    "planningMonthId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "emailSnapshot" TEXT NOT NULL,
    "roleSnapshot" TEXT NOT NULL,
    "participationMode" "ParticipationMode" NOT NULL DEFAULT 'NORMAL',
    "shadowDayCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySubmission" (
    "id" TEXT NOT NULL,
    "planningMemberId" TEXT NOT NULL,
    "mode" "AvailabilityMode" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityDate" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,

    CONSTRAINT "AvailabilityDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleRun" (
    "id" TEXT NOT NULL,
    "planningMonthId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "fairnessScore" INTEGER NOT NULL,
    "inputSnapshot" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "basedOnRunId" TEXT,
    "revisionReason" TEXT,
    "validationWarnings" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "ScheduleRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleAssignment" (
    "id" TEXT NOT NULL,
    "scheduleRunId" TEXT NOT NULL,
    "planningMemberId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "roleSnapshot" TEXT NOT NULL,

    CONSTRAINT "ScheduleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleShadow" (
    "id" TEXT NOT NULL,
    "scheduleAssignmentId" TEXT NOT NULL,
    "shadowMemberId" TEXT NOT NULL,
    "kind" "ShadowKind" NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "roleSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleShadow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "PlanningMonth_status_idx" ON "PlanningMonth"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningMonth_year_month_key" ON "PlanningMonth"("year", "month");

-- CreateIndex
CREATE INDEX "PlanningMember_userId_idx" ON "PlanningMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningMember_planningMonthId_userId_key" ON "PlanningMember"("planningMonthId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySubmission_planningMemberId_key" ON "AvailabilitySubmission"("planningMemberId");

-- CreateIndex
CREATE INDEX "AvailabilityDate_date_idx" ON "AvailabilityDate"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityDate_submissionId_date_key" ON "AvailabilityDate"("submissionId", "date");

-- CreateIndex
CREATE INDEX "ScheduleRun_generatedAt_idx" ON "ScheduleRun"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleRun_planningMonthId_version_key" ON "ScheduleRun"("planningMonthId", "version");

-- CreateIndex
CREATE INDEX "ScheduleAssignment_planningMemberId_idx" ON "ScheduleAssignment"("planningMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleAssignment_scheduleRunId_date_key" ON "ScheduleAssignment"("scheduleRunId", "date");

-- CreateIndex
CREATE INDEX "ScheduleShadow_shadowMemberId_idx" ON "ScheduleShadow"("shadowMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleShadow_scheduleAssignmentId_shadowMemberId_key" ON "ScheduleShadow"("scheduleAssignmentId", "shadowMemberId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningMonth" ADD CONSTRAINT "PlanningMonth_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningMember" ADD CONSTRAINT "PlanningMember_planningMonthId_fkey" FOREIGN KEY ("planningMonthId") REFERENCES "PlanningMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningMember" ADD CONSTRAINT "PlanningMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySubmission" ADD CONSTRAINT "AvailabilitySubmission_planningMemberId_fkey" FOREIGN KEY ("planningMemberId") REFERENCES "PlanningMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityDate" ADD CONSTRAINT "AvailabilityDate_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AvailabilitySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleRun" ADD CONSTRAINT "ScheduleRun_planningMonthId_fkey" FOREIGN KEY ("planningMonthId") REFERENCES "PlanningMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleRun" ADD CONSTRAINT "ScheduleRun_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleRun" ADD CONSTRAINT "ScheduleRun_basedOnRunId_fkey" FOREIGN KEY ("basedOnRunId") REFERENCES "ScheduleRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_scheduleRunId_fkey" FOREIGN KEY ("scheduleRunId") REFERENCES "ScheduleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_planningMemberId_fkey" FOREIGN KEY ("planningMemberId") REFERENCES "PlanningMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleShadow" ADD CONSTRAINT "ScheduleShadow_scheduleAssignmentId_fkey" FOREIGN KEY ("scheduleAssignmentId") REFERENCES "ScheduleAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleShadow" ADD CONSTRAINT "ScheduleShadow_shadowMemberId_fkey" FOREIGN KEY ("shadowMemberId") REFERENCES "PlanningMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
