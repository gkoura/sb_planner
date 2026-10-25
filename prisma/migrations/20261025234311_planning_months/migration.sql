-- CreateTable
CREATE TABLE "PlanningMonth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanningMonth_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanningMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planningMonthId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "emailSnapshot" TEXT NOT NULL,
    "roleSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanningMember_planningMonthId_fkey" FOREIGN KEY ("planningMonthId") REFERENCES "PlanningMonth" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanningMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlanningMonth_status_idx" ON "PlanningMonth"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningMonth_year_month_key" ON "PlanningMonth"("year", "month");

-- CreateIndex
CREATE INDEX "PlanningMember_userId_idx" ON "PlanningMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningMember_planningMonthId_userId_key" ON "PlanningMember"("planningMonthId", "userId");
