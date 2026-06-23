-- CreateTable
CREATE TABLE "department_holiday_targets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "holiday_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_holiday_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_holiday_opt_outs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "holiday_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "opted_out_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_holiday_opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_holiday_targets_organization_id_department_id_idx" ON "department_holiday_targets"("organization_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_holiday_targets_holiday_id_department_id_key" ON "department_holiday_targets"("holiday_id", "department_id");

-- CreateIndex
CREATE INDEX "department_holiday_opt_outs_organization_id_department_id_idx" ON "department_holiday_opt_outs"("organization_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_holiday_opt_outs_holiday_id_department_id_key" ON "department_holiday_opt_outs"("holiday_id", "department_id");

-- AddForeignKey
ALTER TABLE "department_holiday_targets" ADD CONSTRAINT "department_holiday_targets_holiday_id_fkey" FOREIGN KEY ("holiday_id") REFERENCES "department_holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_holiday_opt_outs" ADD CONSTRAINT "department_holiday_opt_outs_holiday_id_fkey" FOREIGN KEY ("holiday_id") REFERENCES "department_holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;
