-- CreateEnum
CREATE TYPE "ReminderRecurrence" AS ENUM ('one_time', 'yearly');

-- AlterTable
ALTER TABLE "recurring_templates" ADD COLUMN     "reminder_specs" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "task_reminders" ADD COLUMN     "offset_days" INTEGER,
ADD COLUMN     "recurrence" "ReminderRecurrence" NOT NULL DEFAULT 'one_time';
