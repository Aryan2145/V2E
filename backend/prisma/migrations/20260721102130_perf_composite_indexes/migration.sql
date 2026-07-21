-- CreateIndex
CREATE INDEX "goals_organization_id_owner_user_id_idx" ON "goals"("organization_id", "owner_user_id");

-- CreateIndex
CREATE INDEX "meeting_attendees_organization_id_user_id_idx" ON "meeting_attendees"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "organization_members_organization_id_is_active_idx" ON "organization_members"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "task_assignees_organization_id_user_id_is_completed_idx" ON "task_assignees"("organization_id", "user_id", "is_completed");

-- CreateIndex
CREATE INDEX "tasks_organization_id_status_id_idx" ON "tasks"("organization_id", "status_id");

-- CreateIndex
CREATE INDEX "tickets_organization_id_status_id_idx" ON "tickets"("organization_id", "status_id");

-- CreateIndex
CREATE INDEX "tickets_organization_id_sla_breached_sla_due_at_idx" ON "tickets"("organization_id", "sla_breached", "sla_due_at");
