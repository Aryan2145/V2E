-- CreateIndex
CREATE INDEX "learning_item_progress_employee_profile_id_idx" ON "learning_item_progress"("employee_profile_id");

-- CreateIndex
CREATE INDEX "learning_path_assignments_employee_profile_id_idx" ON "learning_path_assignments"("employee_profile_id");

-- CreateIndex
CREATE INDEX "task_activity_logs_task_id_idx" ON "task_activity_logs"("task_id");

-- CreateIndex
CREATE INDEX "task_activity_logs_organization_id_idx" ON "task_activity_logs"("organization_id");

-- CreateIndex
CREATE INDEX "task_assignees_user_id_idx" ON "task_assignees"("user_id");

-- CreateIndex
CREATE INDEX "task_assignees_organization_id_idx" ON "task_assignees"("organization_id");

-- CreateIndex
CREATE INDEX "task_checklists_task_id_idx" ON "task_checklists"("task_id");

-- CreateIndex
CREATE INDEX "task_checklists_organization_id_idx" ON "task_checklists"("organization_id");

-- CreateIndex
CREATE INDEX "task_comments_task_id_idx" ON "task_comments"("task_id");

-- CreateIndex
CREATE INDEX "task_comments_organization_id_idx" ON "task_comments"("organization_id");

-- CreateIndex
CREATE INDEX "task_escalations_task_id_idx" ON "task_escalations"("task_id");

-- CreateIndex
CREATE INDEX "task_escalations_organization_id_idx" ON "task_escalations"("organization_id");

-- CreateIndex
CREATE INDEX "task_escalations_escalate_to_user_id_idx" ON "task_escalations"("escalate_to_user_id");

-- CreateIndex
CREATE INDEX "task_reminders_task_id_idx" ON "task_reminders"("task_id");

-- CreateIndex
CREATE INDEX "task_reminders_organization_id_idx" ON "task_reminders"("organization_id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_idx" ON "tasks"("organization_id");

-- CreateIndex
CREATE INDEX "tasks_created_by_user_id_idx" ON "tasks"("created_by_user_id");

-- CreateIndex
CREATE INDEX "tasks_department_id_idx" ON "tasks"("department_id");
