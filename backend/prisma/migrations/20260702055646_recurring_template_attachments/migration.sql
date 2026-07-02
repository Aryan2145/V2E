-- CreateTable
CREATE TABLE "recurring_template_attachments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "recurring_template_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_template_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_template_attachments_recurring_template_id_idx" ON "recurring_template_attachments"("recurring_template_id");

-- CreateIndex
CREATE INDEX "recurring_template_attachments_organization_id_idx" ON "recurring_template_attachments"("organization_id");

-- AddForeignKey
ALTER TABLE "recurring_template_attachments" ADD CONSTRAINT "recurring_template_attachments_recurring_template_id_fkey" FOREIGN KEY ("recurring_template_id") REFERENCES "recurring_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
