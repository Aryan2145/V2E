-- CreateEnum
CREATE TYPE "LeaveState" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "LeaveOrigin" AS ENUM ('requested', 'self_declared');

-- AlterEnum
ALTER TYPE "NotificationModule" ADD VALUE 'leave';

-- AlterEnum
-- Existing rows already migrated from 'on_leave' to 'active' before this runs.
BEGIN;
CREATE TYPE "EmployeeStatus_new" AS ENUM ('active', 'inactive');
ALTER TABLE "employee_profiles" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "employee_profiles" ALTER COLUMN "status" TYPE "EmployeeStatus_new" USING ("status"::text::"EmployeeStatus_new");
ALTER TYPE "EmployeeStatus" RENAME TO "EmployeeStatus_old";
ALTER TYPE "EmployeeStatus_new" RENAME TO "EmployeeStatus";
DROP TYPE "EmployeeStatus_old";
ALTER TABLE "employee_profiles" ALTER COLUMN "status" SET DEFAULT 'active';
COMMIT;

-- CreateTable
CREATE TABLE "leaves" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "state" "LeaveState" NOT NULL DEFAULT 'pending',
    "origin" "LeaveOrigin" NOT NULL DEFAULT 'requested',
    "overridden" BOOLEAN NOT NULL DEFAULT false,
    "decided_by_user_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_masters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "approval_mode" TEXT NOT NULL DEFAULT 'manager',
    "approver_user_ids" JSONB NOT NULL DEFAULT '[]',
    "any_one_can_approve" BOOLEAN NOT NULL DEFAULT true,
    "allow_override" BOOLEAN NOT NULL DEFAULT true,
    "recurring_notice_days" INTEGER NOT NULL DEFAULT 3,
    "config_manage_roles" JSONB NOT NULL DEFAULT '["org_admin"]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_masters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leaves_organization_id_user_id_start_date_end_date_idx" ON "leaves"("organization_id", "user_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "leaves_organization_id_state_idx" ON "leaves"("organization_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "leave_masters_organization_id_key" ON "leave_masters"("organization_id");
