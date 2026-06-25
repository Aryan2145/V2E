-- CreateEnum
CREATE TYPE "ChecklistAccessMode" AS ENUM ('everyone', 'restricted');

-- CreateEnum
CREATE TYPE "ChecklistAccessKind" AS ENUM ('department', 'role', 'user');

-- AlterTable
ALTER TABLE "task_checklist_templates" ADD COLUMN     "access_mode" "ChecklistAccessMode" NOT NULL DEFAULT 'everyone';

-- CreateTable
CREATE TABLE "checklist_template_access_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "kind" "ChecklistAccessKind" NOT NULL,
    "department_id" TEXT,
    "include_sub_departments" BOOLEAN NOT NULL DEFAULT true,
    "role_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_template_access_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklist_template_access_rules_organization_id_template_id_idx" ON "checklist_template_access_rules"("organization_id", "template_id");

-- AddForeignKey
ALTER TABLE "checklist_template_access_rules" ADD CONSTRAINT "checklist_template_access_rules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "task_checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
