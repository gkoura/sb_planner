-- CreateTable
CREATE TABLE "ScheduleShadow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleAssignmentId" TEXT NOT NULL,
    "shadowMemberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "roleSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleShadow_scheduleAssignmentId_fkey" FOREIGN KEY ("scheduleAssignmentId") REFERENCES "ScheduleAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleShadow_shadowMemberId_fkey" FOREIGN KEY ("shadowMemberId") REFERENCES "PlanningMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlanningMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planningMonthId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "emailSnapshot" TEXT NOT NULL,
    "roleSnapshot" TEXT NOT NULL,
    "participationMode" TEXT NOT NULL DEFAULT 'NORMAL',
    "shadowDayCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanningMember_planningMonthId_fkey" FOREIGN KEY ("planningMonthId") REFERENCES "PlanningMonth" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanningMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PlanningMember" ("createdAt", "emailSnapshot", "id", "nameSnapshot", "planningMonthId", "roleSnapshot", "updatedAt", "userId") SELECT "createdAt", "emailSnapshot", "id", "nameSnapshot", "planningMonthId", "roleSnapshot", "updatedAt", "userId" FROM "PlanningMember";
DROP TABLE "PlanningMember";
ALTER TABLE "new_PlanningMember" RENAME TO "PlanningMember";
CREATE INDEX "PlanningMember_userId_idx" ON "PlanningMember"("userId");
CREATE UNIQUE INDEX "PlanningMember_planningMonthId_userId_key" ON "PlanningMember"("planningMonthId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ScheduleShadow_shadowMemberId_idx" ON "ScheduleShadow"("shadowMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleShadow_scheduleAssignmentId_shadowMemberId_key" ON "ScheduleShadow"("scheduleAssignmentId", "shadowMemberId");
