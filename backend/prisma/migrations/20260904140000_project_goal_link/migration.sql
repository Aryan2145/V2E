-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "goal_id" TEXT;

-- CreateIndex
CREATE INDEX "projects_organization_id_goal_id_idx" ON "projects"("organization_id", "goal_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
