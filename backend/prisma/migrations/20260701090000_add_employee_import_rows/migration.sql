-- CreateEnum
CREATE TYPE "ImportRowResultStatus" AS ENUM ('created', 'failed');

-- CreateTable
CREATE TABLE "employee_import_rows" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "row_num" INTEGER NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "status" "ImportRowResultStatus" NOT NULL,
    "error" TEXT,
    "payload" JSONB NOT NULL,
    "created_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_import_rows_batch_id_idx" ON "employee_import_rows"("batch_id");

-- AddForeignKey
ALTER TABLE "employee_import_rows" ADD CONSTRAINT "employee_import_rows_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "employee_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
