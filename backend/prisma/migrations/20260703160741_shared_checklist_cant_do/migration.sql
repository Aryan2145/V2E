-- AlterTable
ALTER TABLE "task_checklists" ADD COLUMN     "cant_do" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cant_do_reason" TEXT;
