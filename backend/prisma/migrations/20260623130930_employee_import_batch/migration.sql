-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('committed', 'undone', 'partially_undone');

-- AlterTable
ALTER TABLE "employee_profiles" ADD COLUMN     "import_batch_id" TEXT;

-- CreateTable
CREATE TABLE "employee_import_batches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "imported_by_user_id" TEXT NOT NULL,
    "file_name" TEXT,
    "total_rows" INTEGER NOT NULL,
    "created_count" INTEGER NOT NULL,
    "failed_count" INTEGER NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'committed',
    "undo_summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undone_at" TIMESTAMP(3),

    CONSTRAINT "employee_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_import_batches_organization_id_idx" ON "employee_import_batches"("organization_id");

-- CreateIndex
CREATE INDEX "employee_profiles_import_batch_id_idx" ON "employee_profiles"("import_batch_id");

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "employee_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_import_batches" ADD CONSTRAINT "employee_import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_import_batches" ADD CONSTRAINT "employee_import_batches_imported_by_user_id_fkey" FOREIGN KEY ("imported_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
