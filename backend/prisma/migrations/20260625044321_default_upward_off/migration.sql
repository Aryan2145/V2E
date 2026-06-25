-- AlterTable
ALTER TABLE "departments" ALTER COLUMN "assignee_allow_upward" SET DEFAULT false;

-- Upward assignment is now restrictive by default everywhere: flip existing departments to OFF.
UPDATE "departments" SET "assignee_allow_upward" = false;
