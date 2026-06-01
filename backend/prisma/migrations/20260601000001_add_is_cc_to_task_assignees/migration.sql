-- Add CC flag to task_assignees (existing rows default to false = regular assignee)
ALTER TABLE "task_assignees" ADD COLUMN IF NOT EXISTS "is_cc" BOOLEAN NOT NULL DEFAULT false;
