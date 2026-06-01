-- Add reopen window config to task_masters
ALTER TABLE "task_masters" ADD COLUMN IF NOT EXISTS "reopen_window_minutes" INTEGER NOT NULL DEFAULT 10;

-- Add reopen tracking columns to tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "reopened_at" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "reopen_expires_at" TIMESTAMP(3);
