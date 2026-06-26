-- CreateEnum
CREATE TYPE "GoalConfidence" AS ENUM ('on_track', 'at_risk', 'off_track');

-- CreateEnum
CREATE TYPE "GoalCadence" AS ENUM ('none', 'weekly', 'biweekly', 'monthly', 'quarterly');

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "last_check_in_at" TIMESTAMP(3),
ADD COLUMN     "last_confidence" "GoalConfidence",
ADD COLUMN     "next_review_date" TIMESTAMP(3),
ADD COLUMN     "review_cadence" "GoalCadence" NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "goal_check_ins" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "check_in_date" TIMESTAMP(3) NOT NULL,
    "confidence" "GoalConfidence" NOT NULL,
    "progress_percent" DOUBLE PRECISION NOT NULL,
    "status_note" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measure_check_ins" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "goal_check_in_id" TEXT NOT NULL,
    "goal_measure_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measure_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goal_check_ins_goal_id_check_in_date_idx" ON "goal_check_ins"("goal_id", "check_in_date");

-- CreateIndex
CREATE INDEX "measure_check_ins_goal_measure_id_created_at_idx" ON "measure_check_ins"("goal_measure_id", "created_at");

-- CreateIndex
CREATE INDEX "measure_check_ins_goal_check_in_id_idx" ON "measure_check_ins"("goal_check_in_id");

-- CreateIndex
CREATE INDEX "goals_organization_id_next_review_date_idx" ON "goals"("organization_id", "next_review_date");

-- AddForeignKey
ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measure_check_ins" ADD CONSTRAINT "measure_check_ins_goal_check_in_id_fkey" FOREIGN KEY ("goal_check_in_id") REFERENCES "goal_check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measure_check_ins" ADD CONSTRAINT "measure_check_ins_goal_measure_id_fkey" FOREIGN KEY ("goal_measure_id") REFERENCES "goal_measures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
