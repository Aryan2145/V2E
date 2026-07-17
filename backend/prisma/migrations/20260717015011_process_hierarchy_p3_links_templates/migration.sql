-- AlterTable
ALTER TABLE "process_nodes" ADD COLUMN     "linked_map_id" TEXT;

-- CreateTable
CREATE TABLE "process_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tree_json" JSONB NOT NULL,
    "source_map_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "process_templates_organization_id_idx" ON "process_templates"("organization_id");
