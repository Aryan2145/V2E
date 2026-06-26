-- CreateEnum
CREATE TYPE "TicketAssignmentStrategy" AS ENUM ('round_robin', 'claim', 'manual');

-- CreateEnum
CREATE TYPE "TicketTemplateAccessMode" AS ENUM ('everyone', 'restricted');

-- CreateEnum
CREATE TYPE "TicketTemplateAccessKind" AS ENUM ('department', 'role', 'user', 'exclude_user', 'exclude_role');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TicketActivityAction" ADD VALUE 'rejected';
ALTER TYPE "TicketActivityAction" ADD VALUE 'transferred';
ALTER TYPE "TicketActivityAction" ADD VALUE 'put_on_hold';
ALTER TYPE "TicketActivityAction" ADD VALUE 'resumed';
ALTER TYPE "TicketActivityAction" ADD VALUE 'first_responded';
ALTER TYPE "TicketActivityAction" ADD VALUE 'response_breached';
ALTER TYPE "TicketActivityAction" ADD VALUE 'claimed';

-- AlterEnum
ALTER TYPE "TicketStatusType" ADD VALUE 'on_hold';

-- AlterTable
ALTER TABLE "ticket_categories" ADD COLUMN     "default_response_sla_hours" INTEGER,
ADD COLUMN     "resolver_group_id" TEXT;

-- AlterTable
ALTER TABLE "ticket_masters" ADD COLUMN     "allow_assignee_reopen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allow_requester_reopen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "default_response_sla_hours" INTEGER,
ADD COLUMN     "escalation_interval_hours" INTEGER NOT NULL DEFAULT 24;

-- AlterTable
ALTER TABLE "ticket_templates" ADD COLUMN     "access_mode" "TicketTemplateAccessMode" NOT NULL DEFAULT 'everyone',
ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "group_label" TEXT,
ADD COLUMN     "lock_priority" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resolver_group_id" TEXT,
ADD COLUMN     "response_sla_hours" INTEGER;

-- AlterTable
ALTER TABLE "ticket_types" ADD COLUMN     "default_response_sla_hours" INTEGER,
ADD COLUMN     "resolver_group_id" TEXT;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "hold_since" TIMESTAMP(3),
ADD COLUMN     "on_hold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reopen_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resolver_group_id" TEXT,
ADD COLUMN     "responded_at" TIMESTAMP(3),
ADD COLUMN     "response_breached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "response_due_at" TIMESTAMP(3),
ADD COLUMN     "response_sla_hours" INTEGER,
ADD COLUMN     "total_hold_seconds" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ticket_resolver_groups" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "department_id" TEXT,
    "assignment_strategy" "TicketAssignmentStrategy" NOT NULL DEFAULT 'round_robin',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_resolver_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_resolver_group_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "resolver_group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_resolver_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_template_access_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "kind" "TicketTemplateAccessKind" NOT NULL,
    "department_id" TEXT,
    "include_sub_departments" BOOLEAN NOT NULL DEFAULT true,
    "role_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_template_access_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_resolver_group_members_resolver_group_id_user_id_key" ON "ticket_resolver_group_members"("resolver_group_id", "user_id");

-- AddForeignKey
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_resolver_group_id_fkey" FOREIGN KEY ("resolver_group_id") REFERENCES "ticket_resolver_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_resolver_group_id_fkey" FOREIGN KEY ("resolver_group_id") REFERENCES "ticket_resolver_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_templates" ADD CONSTRAINT "ticket_templates_resolver_group_id_fkey" FOREIGN KEY ("resolver_group_id") REFERENCES "ticket_resolver_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_resolver_group_members" ADD CONSTRAINT "ticket_resolver_group_members_resolver_group_id_fkey" FOREIGN KEY ("resolver_group_id") REFERENCES "ticket_resolver_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_template_access_rules" ADD CONSTRAINT "ticket_template_access_rules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "ticket_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
