-- CreateEnum
CREATE TYPE "ProcessNodeKind" AS ENUM ('container', 'task', 'decision', 'subprocess', 'start_event', 'end_event');

-- CreateEnum
CREATE TYPE "ProcessNodeStatus" AS ENUM ('draft', 'in_review', 'final');

-- CreateEnum
CREATE TYPE "ProcessConditionKind" AS ENUM ('none', 'yes', 'no');

-- CreateEnum
CREATE TYPE "ProcessArtifactType" AS ENUM ('form', 'report', 'document', 'data', 'other');

-- CreateEnum
CREATE TYPE "ProcessArtifactDirection" AS ENUM ('input', 'output');

-- CreateEnum
CREATE TYPE "ProcessAccessKind" AS ENUM ('department', 'role', 'user', 'exclude_user');

-- CreateEnum
CREATE TYPE "ProcessAccessLevel" AS ENUM ('view', 'edit');

-- CreateEnum
CREATE TYPE "ProcessSnapshotStatus" AS ENUM ('draft', 'in_review', 'final');

-- CreateTable
CREATE TABLE "process_maps" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_nodes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "map_id" TEXT NOT NULL,
    "parent_node_id" TEXT,
    "kind" "ProcessNodeKind" NOT NULL DEFAULT 'task',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProcessNodeStatus" NOT NULL DEFAULT 'draft',
    "responsible_role_id" TEXT,
    "responsible_user_id" TEXT,
    "position_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "map_id" TEXT NOT NULL,
    "parent_node_id" TEXT,
    "source_node_id" TEXT NOT NULL,
    "target_node_id" TEXT NOT NULL,
    "label" TEXT,
    "condition_kind" "ProcessConditionKind" NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_artifacts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "map_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "artifact_type" "ProcessArtifactType" NOT NULL DEFAULT 'document',
    "file_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "storage_key" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_node_artifacts" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "direction" "ProcessArtifactDirection" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_node_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_checklist_items" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_node_access" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "kind" "ProcessAccessKind" NOT NULL,
    "level" "ProcessAccessLevel" NOT NULL DEFAULT 'view',
    "department_id" TEXT,
    "include_sub_departments" BOOLEAN NOT NULL DEFAULT true,
    "role_id" TEXT,
    "user_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_node_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "map_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "ProcessSnapshotStatus" NOT NULL DEFAULT 'draft',
    "tree_json" JSONB NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "process_maps_organization_id_idx" ON "process_maps"("organization_id");

-- CreateIndex
CREATE INDEX "process_nodes_organization_id_idx" ON "process_nodes"("organization_id");

-- CreateIndex
CREATE INDEX "process_nodes_map_id_idx" ON "process_nodes"("map_id");

-- CreateIndex
CREATE INDEX "process_nodes_parent_node_id_idx" ON "process_nodes"("parent_node_id");

-- CreateIndex
CREATE INDEX "process_connections_organization_id_idx" ON "process_connections"("organization_id");

-- CreateIndex
CREATE INDEX "process_connections_map_id_idx" ON "process_connections"("map_id");

-- CreateIndex
CREATE INDEX "process_connections_parent_node_id_idx" ON "process_connections"("parent_node_id");

-- CreateIndex
CREATE INDEX "process_artifacts_organization_id_idx" ON "process_artifacts"("organization_id");

-- CreateIndex
CREATE INDEX "process_artifacts_map_id_idx" ON "process_artifacts"("map_id");

-- CreateIndex
CREATE INDEX "process_node_artifacts_node_id_idx" ON "process_node_artifacts"("node_id");

-- CreateIndex
CREATE INDEX "process_node_artifacts_artifact_id_idx" ON "process_node_artifacts"("artifact_id");

-- CreateIndex
CREATE UNIQUE INDEX "process_node_artifacts_node_id_artifact_id_direction_key" ON "process_node_artifacts"("node_id", "artifact_id", "direction");

-- CreateIndex
CREATE INDEX "process_checklist_items_node_id_idx" ON "process_checklist_items"("node_id");

-- CreateIndex
CREATE INDEX "process_node_access_organization_id_node_id_idx" ON "process_node_access"("organization_id", "node_id");

-- CreateIndex
CREATE INDEX "process_node_access_node_id_idx" ON "process_node_access"("node_id");

-- CreateIndex
CREATE INDEX "process_snapshots_organization_id_map_id_idx" ON "process_snapshots"("organization_id", "map_id");

-- AddForeignKey
ALTER TABLE "process_nodes" ADD CONSTRAINT "process_nodes_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "process_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_nodes" ADD CONSTRAINT "process_nodes_parent_node_id_fkey" FOREIGN KEY ("parent_node_id") REFERENCES "process_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_connections" ADD CONSTRAINT "process_connections_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "process_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_artifacts" ADD CONSTRAINT "process_artifacts_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "process_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_node_artifacts" ADD CONSTRAINT "process_node_artifacts_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "process_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_node_artifacts" ADD CONSTRAINT "process_node_artifacts_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "process_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_checklist_items" ADD CONSTRAINT "process_checklist_items_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "process_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_node_access" ADD CONSTRAINT "process_node_access_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "process_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_snapshots" ADD CONSTRAINT "process_snapshots_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "process_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
