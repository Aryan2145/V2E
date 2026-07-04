-- AlterTable
ALTER TABLE "recurring_templates" ADD COLUMN     "escalation_user_ids" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "proof_allowed_extensions" TEXT[] DEFAULT ARRAY[]::TEXT[];
