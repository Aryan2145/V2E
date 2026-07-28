-- CreateEnum
CREATE TYPE "ProcessPool" AS ENUM ('customer', 'company', 'vendor');

-- CreateEnum
CREATE TYPE "ProcessLaneOrigin" AS ENUM ('manual', 'auto');

-- AlterTable
ALTER TABLE "process_nodes" ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "pool" "ProcessPool";

-- CreateTable
CREATE TABLE "process_lanes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "map_id" TEXT NOT NULL,
    "parent_node_id" TEXT,
    "department_id" TEXT NOT NULL,
    "origin" "ProcessLaneOrigin" NOT NULL DEFAULT 'manual',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_lanes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "process_lanes_organization_id_idx" ON "process_lanes"("organization_id");

-- CreateIndex
CREATE INDEX "process_lanes_map_id_parent_node_id_idx" ON "process_lanes"("map_id", "parent_node_id");

-- AddForeignKey
ALTER TABLE "process_lanes" ADD CONSTRAINT "process_lanes_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "process_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
