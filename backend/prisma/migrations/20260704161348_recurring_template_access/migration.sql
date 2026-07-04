-- CreateEnum
CREATE TYPE "RecurringAccessKind" AS ENUM ('grant', 'revoke');

-- CreateEnum
CREATE TYPE "RecurringAccessLevel" AS ENUM ('view', 'edit');

-- CreateTable
CREATE TABLE "recurring_template_access" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "recurring_template_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "RecurringAccessKind" NOT NULL,
    "level" "RecurringAccessLevel",
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_template_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_template_access_recurring_template_id_idx" ON "recurring_template_access"("recurring_template_id");

-- CreateIndex
CREATE INDEX "recurring_template_access_organization_id_idx" ON "recurring_template_access"("organization_id");

-- CreateIndex
CREATE INDEX "recurring_template_access_user_id_idx" ON "recurring_template_access"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_template_access_recurring_template_id_user_id_key" ON "recurring_template_access"("recurring_template_id", "user_id");

-- AddForeignKey
ALTER TABLE "recurring_template_access" ADD CONSTRAINT "recurring_template_access_recurring_template_id_fkey" FOREIGN KEY ("recurring_template_id") REFERENCES "recurring_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

