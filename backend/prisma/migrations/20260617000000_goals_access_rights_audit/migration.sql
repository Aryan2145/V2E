-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('read', 'write', 'edit', 'delete');

-- CreateEnum
CREATE TYPE "GoalLevel" AS ENUM ('objective', 'annual', 'quarterly');

-- CreateEnum
CREATE TYPE "GoalPerspective" AS ENUM ('financial', 'customer', 'internal_process', 'learning_growth');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('not_started', 'on_track', 'at_risk', 'achieved', 'archived');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "goal_id" TEXT;

-- CreateTable
CREATE TABLE "access_rights" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "resource" TEXT NOT NULL,
    "can_read" BOOLEAN NOT NULL DEFAULT false,
    "can_write" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_rights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_label" TEXT,
    "changes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "level" "GoalLevel" NOT NULL,
    "parent_goal_id" TEXT,
    "perspective" "GoalPerspective",
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner_user_id" TEXT NOT NULL,
    "department_id" TEXT,
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'not_started',
    "progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" TEXT,
    "deletion_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_measures" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_value" TEXT NOT NULL,
    "current_value" TEXT,
    "unit" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_measures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_rights_organization_id_role_resource_key" ON "access_rights"("organization_id", "role", "resource");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_resource_created_at_idx" ON "audit_logs"("organization_id", "resource", "created_at");

-- CreateIndex
CREATE INDEX "goals_organization_id_level_idx" ON "goals"("organization_id", "level");

-- CreateIndex
CREATE INDEX "goals_parent_goal_id_idx" ON "goals"("parent_goal_id");

-- CreateIndex
CREATE INDEX "goal_measures_goal_id_idx" ON "goal_measures"("goal_id");

-- CreateIndex
CREATE INDEX "tasks_goal_id_idx" ON "tasks"("goal_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_goal_id_fkey" FOREIGN KEY ("parent_goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_measures" ADD CONSTRAINT "goal_measures_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
