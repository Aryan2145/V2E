-- AlterTable
ALTER TABLE "task_checklist_templates" ADD COLUMN     "import_batch_id" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "checklist_template_import_batches" (
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

    CONSTRAINT "checklist_template_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklist_template_import_batches_organization_id_idx" ON "checklist_template_import_batches"("organization_id");

-- CreateIndex
CREATE INDEX "task_checklist_templates_import_batch_id_idx" ON "task_checklist_templates"("import_batch_id");

-- AddForeignKey
ALTER TABLE "task_checklist_templates" ADD CONSTRAINT "task_checklist_templates_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "checklist_template_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
