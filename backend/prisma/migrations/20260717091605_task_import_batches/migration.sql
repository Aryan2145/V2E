-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "import_batch_id" TEXT;

-- CreateTable
CREATE TABLE "task_import_batches" (
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

    CONSTRAINT "task_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_import_rows" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "row_num" INTEGER NOT NULL,
    "title" TEXT,
    "status" "ImportRowResultStatus" NOT NULL,
    "error" TEXT,
    "payload" JSONB NOT NULL,
    "created_task_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_import_batches_organization_id_idx" ON "task_import_batches"("organization_id");

-- CreateIndex
CREATE INDEX "task_import_rows_batch_id_idx" ON "task_import_rows"("batch_id");

-- CreateIndex
CREATE INDEX "tasks_import_batch_id_idx" ON "tasks"("import_batch_id");

-- AddForeignKey
ALTER TABLE "task_import_batches" ADD CONSTRAINT "task_import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_import_batches" ADD CONSTRAINT "task_import_batches_imported_by_user_id_fkey" FOREIGN KEY ("imported_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_import_rows" ADD CONSTRAINT "task_import_rows_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "task_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "task_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
