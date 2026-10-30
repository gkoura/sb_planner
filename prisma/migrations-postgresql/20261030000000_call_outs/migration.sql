CREATE TYPE "CallOutRole" AS ENUM ('PRIMARY', 'TRAINEE', 'MENTOR', 'SUPPORT');
CREATE TABLE "CallOut" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "role" "CallOutRole" NOT NULL,
    "dutyDate" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CallOut_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CallOut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CallOut_userId_startedAt_idx" ON "CallOut"("userId", "startedAt");
