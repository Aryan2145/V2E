-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskActionType" ADD VALUE 'marked_incomplete';
ALTER TYPE "TaskActionType" ADD VALUE 'part_flagged_incomplete';
ALTER TYPE "TaskActionType" ADD VALUE 'part_flag_cleared';

-- AlterTable
ALTER TABLE "task_assignees" ADD COLUMN     "cannot_complete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cannot_complete_at" TIMESTAMP(3),
ADD COLUMN     "cannot_complete_reason" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "incomplete_reason" TEXT;
