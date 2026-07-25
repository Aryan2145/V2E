-- AlterTable
ALTER TABLE "process_maps" ADD COLUMN     "is_listed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_map_id" TEXT;

-- CreateIndex
CREATE INDEX "process_maps_parent_map_id_idx" ON "process_maps"("parent_map_id");

-- AddForeignKey
ALTER TABLE "process_maps" ADD CONSTRAINT "process_maps_parent_map_id_fkey" FOREIGN KEY ("parent_map_id") REFERENCES "process_maps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
