-- CreateTable
CREATE TABLE "AvailabilitySubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planningMemberId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AvailabilitySubmission_planningMemberId_fkey" FOREIGN KEY ("planningMemberId") REFERENCES "PlanningMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AvailabilityDate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    CONSTRAINT "AvailabilityDate_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AvailabilitySubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySubmission_planningMemberId_key" ON "AvailabilitySubmission"("planningMemberId");

-- CreateIndex
CREATE INDEX "AvailabilityDate_date_idx" ON "AvailabilityDate"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityDate_submissionId_date_key" ON "AvailabilityDate"("submissionId", "date");
