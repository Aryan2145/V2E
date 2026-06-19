-- CreateEnum
CREATE TYPE "OverrideEffect" AS ENUM ('grant', 'revoke');

-- CreateEnum
CREATE TYPE "EntitlementState" AS ENUM ('full', 'preview', 'off');

-- AlterTable
ALTER TABLE "organization_members" ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "job_role_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission_overrides" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "effect" "OverrideEffect" NOT NULL,
    "reason" TEXT,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_eligibility_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subject_key" TEXT NOT NULL,
    "default_eligible" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_eligibility_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_subject_overrides" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject_key" TEXT NOT NULL,
    "effect" "OverrideEffect" NOT NULL,
    "reason" TEXT,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_subject_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_module_entitlements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "state" "EntitlementState" NOT NULL DEFAULT 'off',
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_module_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_permissions_organization_id_job_role_id_idx" ON "role_permissions"("organization_id", "job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_organization_id_job_role_id_feature_key_ac_key" ON "role_permissions"("organization_id", "job_role_id", "feature_key", "action");

-- CreateIndex
CREATE INDEX "user_permission_overrides_organization_id_user_id_idx" ON "user_permission_overrides"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_overrides_organization_id_user_id_feature_k_key" ON "user_permission_overrides"("organization_id", "user_id", "feature_key", "action");

-- CreateIndex
CREATE UNIQUE INDEX "subject_eligibility_policies_organization_id_subject_key_key" ON "subject_eligibility_policies"("organization_id", "subject_key");

-- CreateIndex
CREATE INDEX "user_subject_overrides_organization_id_subject_key_idx" ON "user_subject_overrides"("organization_id", "subject_key");

-- CreateIndex
CREATE INDEX "user_subject_overrides_organization_id_user_id_idx" ON "user_subject_overrides"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_subject_overrides_organization_id_user_id_subject_key_key" ON "user_subject_overrides"("organization_id", "user_id", "subject_key");

-- CreateIndex
CREATE UNIQUE INDEX "org_module_entitlements_organization_id_module_key_key" ON "org_module_entitlements"("organization_id", "module_key");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subject_overrides" ADD CONSTRAINT "user_subject_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_module_entitlements" ADD CONSTRAINT "org_module_entitlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
