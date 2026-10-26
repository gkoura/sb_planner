-- CreateTable
CREATE TABLE "ScheduleRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planningMonthId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "fairnessScore" INTEGER NOT NULL,
    "inputSnapshot" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleRun_planningMonthId_fkey" FOREIGN KEY ("planningMonthId") REFERENCES "PlanningMonth" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleRun_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleRunId" TEXT NOT NULL,
    "planningMemberId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "roleSnapshot" TEXT NOT NULL,
    CONSTRAINT "ScheduleAssignment_scheduleRunId_fkey" FOREIGN KEY ("scheduleRunId") REFERENCES "ScheduleRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleAssignment_planningMemberId_fkey" FOREIGN KEY ("planningMemberId") REFERENCES "PlanningMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ScheduleRun_generatedAt_idx" ON "ScheduleRun"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleRun_planningMonthId_version_key" ON "ScheduleRun"("planningMonthId", "version");

-- CreateIndex
CREATE INDEX "ScheduleAssignment_planningMemberId_idx" ON "ScheduleAssignment"("planningMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleAssignment_scheduleRunId_date_key" ON "ScheduleAssignment"("scheduleRunId", "date");
