-- CreateTable
CREATE TABLE "employee_assignee_manual_overrides" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_user_id" TEXT NOT NULL,
    "full_visibility" BOOLEAN NOT NULL DEFAULT false,
    "added_user_ids" JSONB NOT NULL DEFAULT '[]',
    "removed_user_ids" JSONB NOT NULL DEFAULT '[]',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_assignee_manual_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_assignee_manual_overrides_organization_id_idx" ON "employee_assignee_manual_overrides"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_assignee_manual_overrides_organization_id_employee_key" ON "employee_assignee_manual_overrides"("organization_id", "employee_user_id");
