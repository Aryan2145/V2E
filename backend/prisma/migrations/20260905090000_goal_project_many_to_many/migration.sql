-- CreateTable
CREATE TABLE "goal_projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goal_projects_organization_id_idx" ON "goal_projects"("organization_id");

-- CreateIndex
CREATE INDEX "goal_projects_project_id_idx" ON "goal_projects"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "goal_projects_goal_id_project_id_key" ON "goal_projects"("goal_id", "project_id");

-- AddForeignKey
ALTER TABLE "goal_projects" ADD CONSTRAINT "goal_projects_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_projects" ADD CONSTRAINT "goal_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry existing single-goal links into the join table, THEN drop the column.
-- (Prisma's diff put the DROP first, which would have thrown the links away.)
INSERT INTO "goal_projects" ("id", "organization_id", "goal_id", "project_id", "created_by_user_id", "created_at")
SELECT gen_random_uuid(), p."organization_id", p."goal_id", p."id", p."created_by_user_id", now()
FROM "projects" p
WHERE p."goal_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_goal_id_fkey";

-- DropIndex
DROP INDEX "projects_organization_id_goal_id_idx";

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "goal_id";
