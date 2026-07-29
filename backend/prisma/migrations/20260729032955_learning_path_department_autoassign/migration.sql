-- AlterTable
ALTER TABLE "learning_paths" ADD COLUMN     "department_id" TEXT;

-- CreateIndex
CREATE INDEX "learning_paths_organization_id_status_department_id_idx" ON "learning_paths"("organization_id", "status", "department_id");
