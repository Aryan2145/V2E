-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "is_overdue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overdue_at" TIMESTAMP(3);
