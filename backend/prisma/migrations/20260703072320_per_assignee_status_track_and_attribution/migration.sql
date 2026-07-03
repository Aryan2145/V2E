-- AlterTable
ALTER TABLE "task_assignees" ADD COLUMN     "status_id" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "completed_by_user_id" TEXT,
ADD COLUMN     "status_actor_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "task_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
