-- CreateEnum
CREATE TYPE "HolidayOptOutSource" AS ENUM ('org', 'department');

-- CreateTable
CREATE TABLE "org_holiday_opt_outs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "org_holiday_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "applies_to_subtree" BOOLEAN NOT NULL DEFAULT true,
    "opted_out_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_holiday_opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "individual_holiday_opt_outs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "holiday_source" "HolidayOptOutSource" NOT NULL,
    "holiday_id" TEXT NOT NULL,
    "opted_out_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "individual_holiday_opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_holiday_opt_outs_organization_id_department_id_idx" ON "org_holiday_opt_outs"("organization_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_holiday_opt_outs_org_holiday_id_department_id_key" ON "org_holiday_opt_outs"("org_holiday_id", "department_id");

-- CreateIndex
CREATE INDEX "individual_holiday_opt_outs_organization_id_user_id_idx" ON "individual_holiday_opt_outs"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "individual_holiday_opt_outs_user_id_holiday_source_holiday__key" ON "individual_holiday_opt_outs"("user_id", "holiday_source", "holiday_id");

-- AddForeignKey
ALTER TABLE "org_holiday_opt_outs" ADD CONSTRAINT "org_holiday_opt_outs_org_holiday_id_fkey" FOREIGN KEY ("org_holiday_id") REFERENCES "org_holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;
