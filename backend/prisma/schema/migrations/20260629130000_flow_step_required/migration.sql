-- AlterTable
ALTER TABLE "FlowStep" ADD COLUMN     "required" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing final steps are required.
UPDATE "FlowStep" SET "required" = true WHERE "isFinal" = true;
