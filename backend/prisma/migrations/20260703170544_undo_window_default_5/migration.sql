-- AlterTable
ALTER TABLE "task_masters" ALTER COLUMN "reopen_window_minutes" SET DEFAULT 5;

-- Move orgs still on the old default (10) down to the new 5-minute undo window.
UPDATE "task_masters" SET "reopen_window_minutes" = 5 WHERE "reopen_window_minutes" = 10;
