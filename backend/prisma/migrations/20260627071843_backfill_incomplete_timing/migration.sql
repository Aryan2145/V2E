-- Backfill: tasks already closed in an `incomplete`-type status get the new
-- `incomplete` completion-timing bucket. completed_at = latest non-CC assignee
-- completion (fallback: updated_at). Runs in its own migration so the enum value
-- (added in the previous migration) is committed before use.
UPDATE "tasks" t
SET
  "completion_timing" = 'incomplete',
  "completed_at" = COALESCE(
    (SELECT MAX(a."completed_at") FROM "task_assignees" a
      WHERE a."task_id" = t.id AND a."is_cc" = false AND a."completed_at" IS NOT NULL),
    t."completed_at",
    t."updated_at"
  )
FROM "task_statuses" s
WHERE s.id = t."status_id"
  AND s."type" = 'incomplete'
  AND t."is_deleted" = false
  AND t."completion_timing" IS NULL;
