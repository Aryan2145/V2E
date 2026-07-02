-- AlterTable
ALTER TABLE "recurring_templates" ADD COLUMN     "checklist_items" JSONB NOT NULL DEFAULT '[]';
