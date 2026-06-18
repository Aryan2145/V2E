-- AlterEnum
ALTER TYPE "NotificationModule" ADD VALUE 'work_logs';

-- CreateTable
CREATE TABLE "daily_updates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "log_date" DATE NOT NULL,
    "stuck" TEXT,
    "decisions" TEXT,
    "day_summary" TEXT,
    "planning_tomorrow" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "daily_update_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_log_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_demands" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigner_user_id" TEXT NOT NULL,
    "assignee_user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_log_demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_demand_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "demand_id" TEXT NOT NULL,
    "schedule_type" "RecurringScheduleType" NOT NULL,
    "every" INTEGER NOT NULL DEFAULT 1,
    "days" JSONB NOT NULL DEFAULT '[]',
    "month_days" JSONB NOT NULL DEFAULT '[]',
    "yearly_dates" JSONB NOT NULL DEFAULT '[]',
    "time" TEXT NOT NULL DEFAULT '09:00',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_condition" "RecurringEndCondition" NOT NULL DEFAULT 'never',
    "end_date" TIMESTAMP(3),
    "end_after" INTEGER,
    "occurrence_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_log_demand_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_submissions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "demand_id" TEXT NOT NULL,
    "writer_user_id" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "period_label" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMP(3),
    "daily_update_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_log_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_remarks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_urls" JSONB,
    "reply_to_remark_id" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_log_remarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_reader_grants" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reader_user_id" TEXT NOT NULL,
    "writer_user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_log_reader_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_settings" (
    "organization_id" TEXT NOT NULL,
    "managers_read_reports" BOOLEAN NOT NULL DEFAULT true,
    "writer_user_ids" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_log_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_updates_organization_id_user_id_log_date_key" ON "daily_updates"("organization_id", "user_id", "log_date");

-- CreateIndex
CREATE UNIQUE INDEX "work_log_submissions_demand_id_due_date_key" ON "work_log_submissions"("demand_id", "due_date");

-- CreateIndex
CREATE INDEX "work_log_remarks_organization_id_target_type_target_id_idx" ON "work_log_remarks"("organization_id", "target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_log_reader_grants_organization_id_reader_user_id_write_key" ON "work_log_reader_grants"("organization_id", "reader_user_id", "writer_user_id");

-- AddForeignKey
ALTER TABLE "work_log_notes" ADD CONSTRAINT "work_log_notes_daily_update_id_fkey" FOREIGN KEY ("daily_update_id") REFERENCES "daily_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_demand_schedules" ADD CONSTRAINT "work_log_demand_schedules_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "work_log_demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_submissions" ADD CONSTRAINT "work_log_submissions_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "work_log_demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_remarks" ADD CONSTRAINT "work_log_remarks_reply_to_remark_id_fkey" FOREIGN KEY ("reply_to_remark_id") REFERENCES "work_log_remarks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

