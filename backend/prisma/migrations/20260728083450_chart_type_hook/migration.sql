-- AlterTable
ALTER TABLE "process_maps" ADD COLUMN     "chart_type" TEXT NOT NULL DEFAULT 'swimlane';

-- AlterTable
ALTER TABLE "process_nodes" ADD COLUMN     "chart_type" TEXT NOT NULL DEFAULT 'swimlane';
