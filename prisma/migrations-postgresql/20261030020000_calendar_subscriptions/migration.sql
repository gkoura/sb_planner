CREATE TYPE "CalendarFeedType" AS ENUM ('ALL', 'PERSONAL');

CREATE TABLE "CalendarSubscription" (
    "userId" TEXT NOT NULL,
    "type" "CalendarFeedType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarSubscription_pkey" PRIMARY KEY ("userId", "type"),
    CONSTRAINT "CalendarSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CalendarSubscription_tokenHash_key" ON "CalendarSubscription"("tokenHash");
