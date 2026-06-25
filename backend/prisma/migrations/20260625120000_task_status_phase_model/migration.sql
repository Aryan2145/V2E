-- Task status "phase model" migration.
--
-- Collapses the old free-form `type` values into the fixed four-phase model:
--   not_started | in_progress | completed | incomplete
-- with the invariants: exactly one not_started/completed/incomplete per org,
-- one-or-more in_progress, and is_default == the not_started row.
--
-- Idempotent-ish: safe to run once on existing data. Real orgs were seeded with
-- todo / in_progress / completed, so the common path is the rename + add-incomplete.

-- 1. Dead special types become ordinary in-progress stages (they were inert anyway).
UPDATE "task_statuses" SET "type" = 'in_progress' WHERE "type" IN ('in_review', 'blocked');

-- 2. Keep a single `todo` per org (lowest order) and rename it to not_started; demote extras.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "organization_id" ORDER BY "order_index" ASC, "created_at" ASC
  ) AS rn
  FROM "task_statuses" WHERE "type" = 'todo'
)
UPDATE "task_statuses" ts SET "type" = 'in_progress'
FROM ranked r WHERE ts."id" = r."id" AND r.rn > 1;

UPDATE "task_statuses" SET "type" = 'not_started' WHERE "type" = 'todo';

-- 3. Collapse duplicate `completed` per org (keep lowest order); demote extras to in_progress.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "organization_id" ORDER BY "order_index" ASC, "created_at" ASC
  ) AS rn
  FROM "task_statuses" WHERE "type" = 'completed'
)
UPDATE "task_statuses" ts SET "type" = 'in_progress'
FROM ranked r WHERE ts."id" = r."id" AND r.rn > 1;

-- 4. Collapse duplicate `not_started` per org (defensive; step 2 normally guarantees one).
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "organization_id" ORDER BY "order_index" ASC, "created_at" ASC
  ) AS rn
  FROM "task_statuses" WHERE "type" = 'not_started'
)
UPDATE "task_statuses" ts SET "type" = 'in_progress'
FROM ranked r WHERE ts."id" = r."id" AND r.rn > 1;

-- 5. Ensure every org that has any statuses also has one active not_started.
INSERT INTO "task_statuses" ("id","organization_id","label","type","color","order_index","is_default","is_active","created_at","updated_at")
SELECT gen_random_uuid(), o."organization_id", 'Not Started', 'not_started', '#6B7280', 0, true, true, now(), now()
FROM (SELECT DISTINCT "organization_id" FROM "task_statuses") o
WHERE NOT EXISTS (
  SELECT 1 FROM "task_statuses" t WHERE t."organization_id" = o."organization_id" AND t."type" = 'not_started' AND t."is_active" = true
);

-- 6. Ensure one active completed per org.
INSERT INTO "task_statuses" ("id","organization_id","label","type","color","order_index","is_default","is_active","created_at","updated_at")
SELECT gen_random_uuid(), o."organization_id", 'Completed', 'completed', '#16A34A',
       (SELECT COALESCE(MAX("order_index"),0)+1 FROM "task_statuses" t2 WHERE t2."organization_id" = o."organization_id"),
       false, true, now(), now()
FROM (SELECT DISTINCT "organization_id" FROM "task_statuses") o
WHERE NOT EXISTS (
  SELECT 1 FROM "task_statuses" t WHERE t."organization_id" = o."organization_id" AND t."type" = 'completed' AND t."is_active" = true
);

-- 7. Ensure one active incomplete per org (new terminal phase — closes the task, tracked separately).
INSERT INTO "task_statuses" ("id","organization_id","label","type","color","order_index","is_default","is_active","created_at","updated_at")
SELECT gen_random_uuid(), o."organization_id", 'Incomplete', 'incomplete', '#DC2626',
       (SELECT COALESCE(MAX("order_index"),0)+1 FROM "task_statuses" t2 WHERE t2."organization_id" = o."organization_id"),
       false, true, now(), now()
FROM (SELECT DISTINCT "organization_id" FROM "task_statuses") o
WHERE NOT EXISTS (
  SELECT 1 FROM "task_statuses" t WHERE t."organization_id" = o."organization_id" AND t."type" = 'incomplete' AND t."is_active" = true
);

-- 8. The default is always the active not_started status — nothing else.
UPDATE "task_statuses" SET "is_default" = false
WHERE NOT ("type" = 'not_started' AND "is_active" = true) AND "is_default" = true;
UPDATE "task_statuses" SET "is_default" = true
WHERE "type" = 'not_started' AND "is_active" = true AND "is_default" = false;
