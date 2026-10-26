-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScheduleRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planningMonthId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "fairnessScore" INTEGER NOT NULL,
    "inputSnapshot" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "basedOnRunId" TEXT,
    "revisionReason" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    CONSTRAINT "ScheduleRun_planningMonthId_fkey" FOREIGN KEY ("planningMonthId") REFERENCES "PlanningMonth" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleRun_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleRun_basedOnRunId_fkey" FOREIGN KEY ("basedOnRunId") REFERENCES "ScheduleRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleRun" ("algorithmVersion", "createdBy", "fairnessScore", "generatedAt", "id", "inputSnapshot", "planningMonthId", "publishedAt", "version") SELECT "algorithmVersion", "createdBy", "fairnessScore", "generatedAt", "id", "inputSnapshot", "planningMonthId", "publishedAt", "version" FROM "ScheduleRun";
DROP TABLE "ScheduleRun";
ALTER TABLE "new_ScheduleRun" RENAME TO "ScheduleRun";
CREATE INDEX "ScheduleRun_generatedAt_idx" ON "ScheduleRun"("generatedAt");
CREATE UNIQUE INDEX "ScheduleRun_planningMonthId_version_key" ON "ScheduleRun"("planningMonthId", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
