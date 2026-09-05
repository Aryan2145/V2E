-- AlterEnum
CREATE TYPE "GoalStatus_new" AS ENUM ('not_started', 'on_track', 'at_risk', 'off_track', 'achieved', 'closed');
ALTER TABLE "public"."goals" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "goals" ALTER COLUMN "status" TYPE "GoalStatus_new" USING ("status"::text::"GoalStatus_new");
-- (goal_check_ins."status" is added further down with the new enum type — nothing to convert)
ALTER TYPE "GoalStatus" RENAME TO "GoalStatus_old";
ALTER TYPE "GoalStatus_new" RENAME TO "GoalStatus";
DROP TYPE "public"."GoalStatus_old";
ALTER TABLE "goals" ALTER COLUMN "status" SET DEFAULT 'not_started';

-- AlterEnum
ALTER TYPE "NotificationModule" ADD VALUE 'goals';

-- DropForeignKey
ALTER TABLE "goal_measures" DROP CONSTRAINT "goal_measures_goal_id_fkey";

-- DropForeignKey
ALTER TABLE "goals" DROP CONSTRAINT "goals_parent_goal_id_fkey";

-- DropForeignKey
ALTER TABLE "measure_check_ins" DROP CONSTRAINT "measure_check_ins_goal_check_in_id_fkey";

-- DropForeignKey
ALTER TABLE "measure_check_ins" DROP CONSTRAINT "measure_check_ins_goal_measure_id_fkey";

-- DropIndex
DROP INDEX "goals_organization_id_level_idx";

-- DropIndex
DROP INDEX "goals_parent_goal_id_idx";

-- AlterTable
ALTER TABLE "goal_check_ins" DROP COLUMN "confidence",
DROP COLUMN "progress_percent",
ADD COLUMN     "is_voided" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recorded_value" DECIMAL(18,2),
ADD COLUMN     "status" "GoalStatus" NOT NULL,
ADD COLUMN     "target_value_at_check_in" DECIMAL(18,2),
ADD COLUMN     "void_reason" TEXT,
ADD COLUMN     "voided_at" TIMESTAMP(3),
ADD COLUMN     "voided_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "goals" DROP COLUMN "last_confidence",
DROP COLUMN "level",
DROP COLUMN "parent_goal_id",
DROP COLUMN "perspective",
DROP COLUMN "progress_percent",
DROP COLUMN "start_date",
ADD COLUMN     "current_value" DECIMAL(18,2),
ADD COLUMN     "target_value" DECIMAL(18,2),
ADD COLUMN     "unit" TEXT;

-- DropTable
DROP TABLE "goal_measures";

-- DropTable
DROP TABLE "measure_check_ins";

-- DropEnum
DROP TYPE "GoalConfidence";

-- DropEnum
DROP TYPE "GoalLevel";

-- DropEnum
DROP TYPE "GoalPerspective";

-- CreateTable
CREATE TABLE "goal_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supporting_goal_id" TEXT NOT NULL,
    "supported_goal_id" TEXT NOT NULL,
    "note" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goal_links_organization_id_idx" ON "goal_links"("organization_id");

-- CreateIndex
CREATE INDEX "goal_links_supported_goal_id_idx" ON "goal_links"("supported_goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "goal_links_supporting_goal_id_supported_goal_id_key" ON "goal_links"("supporting_goal_id", "supported_goal_id");

-- CreateIndex
CREATE INDEX "goals_organization_id_is_deleted_idx" ON "goals"("organization_id", "is_deleted");

-- CreateIndex
CREATE INDEX "goals_organization_id_status_idx" ON "goals"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "goal_links" ADD CONSTRAINT "goal_links_supporting_goal_id_fkey" FOREIGN KEY ("supporting_goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_links" ADD CONSTRAINT "goal_links_supported_goal_id_fkey" FOREIGN KEY ("supported_goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
