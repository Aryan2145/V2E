-- CreateEnum
CREATE TYPE "CompletionTiming" AS ENUM ('early', 'on_time', 'late');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "completion_timing" "CompletionTiming";

-- Backfill completion stamps for tasks already in a `completed` status.
-- completed_at = latest non-CC assignee completion (fallback: updated_at).
-- completion_timing = early/on_time/late vs deadline at day granularity (no deadline => on_time).
WITH completed_tasks AS (
  SELECT
    t.id,
    COALESCE(
      (SELECT MAX(a."completed_at") FROM "task_assignees" a
        WHERE a."task_id" = t.id AND a."is_cc" = false AND a."completed_at" IS NOT NULL),
      t."updated_at"
    ) AS comp_at,
    t."deadline" AS dl
  FROM "tasks" t
  JOIN "task_statuses" s ON s.id = t."status_id"
  WHERE s."type" = 'completed' AND t."is_deleted" = false
)
UPDATE "tasks" t
SET
  "completed_at" = ct.comp_at,
  "completion_timing" = (
    CASE
      WHEN ct.dl IS NULL THEN 'on_time'
      WHEN ct.comp_at::date < ct.dl::date THEN 'early'
      WHEN ct.comp_at::date > ct.dl::date THEN 'late'
      ELSE 'on_time'
    END
  )::"CompletionTiming"
FROM completed_tasks ct
WHERE t.id = ct.id;
