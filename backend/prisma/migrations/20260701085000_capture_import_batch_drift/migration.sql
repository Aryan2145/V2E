-- Baseline of pre-existing drift: the department & role bulk-import features
-- were applied to databases via `prisma db push` and never captured in a
-- migration. This migration records that schema so fresh `migrate deploy`
-- reproduces it. Existing databases already have these objects and mark this
-- migration as applied (via `prisma migrate resolve --applied`).

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "import_batch_id" TEXT;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "import_batch_id" TEXT;

-- CreateTable
CREATE TABLE "department_import_batches" (
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

    CONSTRAINT "department_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_import_batches" (
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

    CONSTRAINT "role_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_import_batches_organization_id_idx" ON "department_import_batches"("organization_id");

-- CreateIndex
CREATE INDEX "role_import_batches_organization_id_idx" ON "role_import_batches"("organization_id");

-- CreateIndex
CREATE INDEX "departments_import_batch_id_idx" ON "departments"("import_batch_id");

-- CreateIndex
CREATE INDEX "roles_import_batch_id_idx" ON "roles"("import_batch_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "department_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "role_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_import_batches" ADD CONSTRAINT "department_import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_import_batches" ADD CONSTRAINT "department_import_batches_imported_by_user_id_fkey" FOREIGN KEY ("imported_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_import_batches" ADD CONSTRAINT "role_import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_import_batches" ADD CONSTRAINT "role_import_batches_imported_by_user_id_fkey" FOREIGN KEY ("imported_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
