-- CreateEnum
CREATE TYPE "ChecklistItemState" AS ENUM ('done', 'skipped');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskActionType" ADD VALUE 'checklist_item_skipped';
ALTER TYPE "TaskActionType" ADD VALUE 'checklist_item_overridden';
ALTER TYPE "TaskActionType" ADD VALUE 'checklist_item_challenged';

-- AlterTable
ALTER TABLE "task_checklists" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "completed_by_user_id" TEXT;

-- CreateTable
CREATE TABLE "task_checklist_item_states" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "state" "ChecklistItemState" NOT NULL,
    "reason" TEXT,
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "marked_by_user_id" TEXT NOT NULL,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_checklist_item_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_checklist_item_states_task_id_idx" ON "task_checklist_item_states"("task_id");

-- CreateIndex
CREATE INDEX "task_checklist_item_states_user_id_idx" ON "task_checklist_item_states"("user_id");

-- CreateIndex
CREATE INDEX "task_checklist_item_states_organization_id_idx" ON "task_checklist_item_states"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_checklist_item_states_checklist_id_user_id_key" ON "task_checklist_item_states"("checklist_id", "user_id");

-- AddForeignKey
ALTER TABLE "task_checklist_item_states" ADD CONSTRAINT "task_checklist_item_states_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "task_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
