-- Remove the "Sensitive groups (hidden from everyone)" assignee-visibility feature.
-- The exclude_departments / exclude_roles excludes are no longer read or written by the
-- application; dropping the backing columns.
ALTER TABLE "task_masters" DROP COLUMN "assignee_exclude_departments";
ALTER TABLE "task_masters" DROP COLUMN "assignee_exclude_roles";
