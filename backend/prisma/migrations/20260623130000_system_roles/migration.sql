-- Delink access-rights from job roles → SYSTEM ROLES.
-- Old role_permissions rows were keyed by job_role_id (job title). Access rights are
-- being rebuilt under System Roles, so the legacy rows are intentionally discarded.
DELETE FROM "role_permissions";

-- ─── DDL (generated from schema diff) ──────────────────────────────────────────
-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_job_role_id_fkey";

-- DropIndex
DROP INDEX "role_permissions_organization_id_job_role_id_feature_key_ac_key";

-- DropIndex
DROP INDEX "role_permissions_organization_id_job_role_id_idx";

-- AlterTable
ALTER TABLE "employee_profiles" ADD COLUMN     "system_role_id" TEXT;

-- AlterTable
ALTER TABLE "role_permissions" DROP COLUMN "job_role_id",
ADD COLUMN     "system_role_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "system_roles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "default_scope" "DataScope" NOT NULL DEFAULT 'own',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_role_module_scopes" (
    "id" TEXT NOT NULL,
    "system_role_id" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "scope" "DataScope" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_role_module_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_roles_organization_id_idx" ON "system_roles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_roles_organization_id_name_key" ON "system_roles"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "system_role_module_scopes_system_role_id_module_key_key" ON "system_role_module_scopes"("system_role_id", "module_key");

-- CreateIndex
CREATE INDEX "role_permissions_organization_id_system_role_id_idx" ON "role_permissions"("organization_id", "system_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_organization_id_system_role_id_feature_key_key" ON "role_permissions"("organization_id", "system_role_id", "feature_key", "action");

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_system_role_id_fkey" FOREIGN KEY ("system_role_id") REFERENCES "system_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_roles" ADD CONSTRAINT "system_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_role_module_scopes" ADD CONSTRAINT "system_role_module_scopes_system_role_id_fkey" FOREIGN KEY ("system_role_id") REFERENCES "system_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_system_role_id_fkey" FOREIGN KEY ("system_role_id") REFERENCES "system_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Data: collapse the dropped `department` scope into `team` (My Team) ────────
-- The 3-level model is Own / My Team / Company (own / team / org). Any existing
-- `department`-scoped overrides map down to `team` (conservative).
UPDATE "user_permission_overrides" SET "scope" = 'team' WHERE "scope" = 'department';

-- ─── Seed: one locked Administrator (System) role per organization ──────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO "system_roles" ("id", "organization_id", "name", "description", "is_system", "is_admin", "default_scope", "created_at", "updated_at")
SELECT gen_random_uuid(), o."id", 'Administrator',
       'Full access to everything. This is a system role — it cannot be edited or deleted.',
       true, true, 'org', now(), now()
FROM "organizations" o;

-- ─── Backfill: assign Administrator to existing admin members ───────────────────
UPDATE "employee_profiles" ep
SET "system_role_id" = sr."id"
FROM "system_roles" sr, "organization_members" om
WHERE sr."organization_id" = ep."organization_id"
  AND sr."is_system" = true
  AND om."organization_id" = ep."organization_id"
  AND om."user_id" = ep."user_id"
  AND om."is_admin" = true;
