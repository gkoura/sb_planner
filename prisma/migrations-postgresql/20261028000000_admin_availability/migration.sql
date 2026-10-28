-- CreateEnum
CREATE TYPE "AvailabilitySource" AS ENUM ('SELF', 'ADMIN');

-- AlterTable
ALTER TABLE "AvailabilitySubmission"
ADD COLUMN "source" "AvailabilitySource" NOT NULL DEFAULT 'SELF',
ADD COLUMN "updatedByUserId" TEXT;
