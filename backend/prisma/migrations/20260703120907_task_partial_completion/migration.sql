-- AlterEnum
ALTER TYPE "CompletionTiming" ADD VALUE 'partial';

-- Backfill: every org that already has task statuses gets a terminal "Partially Completed"
-- status (the auto-set "some did, some couldn't" outcome for all_must_complete tasks).
INSERT INTO "task_statuses" (id, organization_id, label, type, color, order_index, is_default, is_active, created_at, updated_at)
SELECT gen_random_uuid(), o.organization_id, 'Partially Completed', 'partially_completed', '#EA580C', 3, false, true, now(), now()
FROM (SELECT DISTINCT organization_id FROM "task_statuses") o
WHERE NOT EXISTS (
  SELECT 1 FROM "task_statuses" s
  WHERE s.organization_id = o.organization_id AND s.type = 'partially_completed'
);

-- Keep "Incomplete" ordered after the new "Partially Completed" slot.
UPDATE "task_statuses" SET order_index = 4 WHERE type = 'incomplete' AND order_index = 3;
