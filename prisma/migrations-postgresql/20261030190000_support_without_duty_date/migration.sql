ALTER TABLE "CallOut" ALTER COLUMN "dutyDate" DROP NOT NULL;

UPDATE "CallOut" SET "dutyDate" = NULL WHERE "role" = 'SUPPORT';
