-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "recurring_spawn_date" DATE;

-- CreateIndex
CREATE UNIQUE INDEX "tasks_recurring_template_day_unique" ON "tasks"("recurring_template_id", "recurring_spawn_date");
