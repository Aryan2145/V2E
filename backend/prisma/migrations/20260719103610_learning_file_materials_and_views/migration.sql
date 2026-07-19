-- CreateEnum
CREATE TYPE "LearningPreviewStatus" AS ENUM ('none', 'pending', 'ready', 'failed');

-- AlterEnum
ALTER TYPE "ContentType" ADD VALUE 'file';

-- AlterTable
ALTER TABLE "learning_items" ADD COLUMN     "allow_download" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "file_mime" TEXT,
ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "file_size_bytes" INTEGER,
ADD COLUMN     "preview_status" "LearningPreviewStatus" NOT NULL DEFAULT 'none',
ADD COLUMN     "preview_storage_key" TEXT,
ADD COLUMN     "storage_key" TEXT;

-- CreateTable
CREATE TABLE "learning_item_views" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "path_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 1,
    "first_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_item_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_item_views_path_id_idx" ON "learning_item_views"("path_id");

-- CreateIndex
CREATE INDEX "learning_item_views_organization_id_idx" ON "learning_item_views"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_item_views_item_id_employee_profile_id_key" ON "learning_item_views"("item_id", "employee_profile_id");

-- AddForeignKey
ALTER TABLE "learning_item_views" ADD CONSTRAINT "learning_item_views_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "learning_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
