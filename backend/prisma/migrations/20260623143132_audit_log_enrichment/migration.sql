-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_user_id_fkey";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "actor_type" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN     "entity_type" TEXT,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "request_id" TEXT,
ADD COLUMN     "trigger_context" JSONB,
ADD COLUMN     "trigger_source" TEXT,
ADD COLUMN     "user_agent" TEXT,
ALTER COLUMN "actor_user_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_entity_id_idx" ON "audit_logs"("organization_id", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_actor_type_created_at_idx" ON "audit_logs"("organization_id", "actor_type", "created_at");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
