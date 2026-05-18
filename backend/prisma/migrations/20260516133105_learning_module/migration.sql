-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('video', 'document', 'url', 'article');

-- CreateEnum
CREATE TYPE "LearningPathStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "SequentialMode" AS ENUM ('sequential', 'free_form');

-- CreateEnum
CREATE TYPE "CompletionType" AS ENUM ('manual', 'auto_opened');

-- CreateTable
CREATE TABLE "learning_paths" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "status" "LearningPathStatus" NOT NULL DEFAULT 'draft',
    "mode" "SequentialMode" NOT NULL DEFAULT 'free_form',
    "role_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "estimated_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_items" (
    "id" TEXT NOT NULL,
    "path_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content_type" "ContentType" NOT NULL,
    "content_url" TEXT,
    "content_body" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "estimated_minutes" INTEGER,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_path_assignments" (
    "id" TEXT NOT NULL,
    "path_id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "assigned_by_user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'not_started',
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "learning_path_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_item_progress" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'not_started',
    "completion_type" "CompletionType",
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "learning_item_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_path_progress" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "path_id" TEXT NOT NULL,
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "completed_items" INTEGER NOT NULL DEFAULT 0,
    "progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_path_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_path_assignments_path_id_employee_profile_id_key" ON "learning_path_assignments"("path_id", "employee_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_item_progress_assignment_id_item_id_key" ON "learning_item_progress"("assignment_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_path_progress_assignment_id_key" ON "learning_path_progress"("assignment_id");

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_items" ADD CONSTRAINT "learning_items_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_assignments" ADD CONSTRAINT "learning_path_assignments_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_assignments" ADD CONSTRAINT "learning_path_assignments_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_item_progress" ADD CONSTRAINT "learning_item_progress_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "learning_path_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_item_progress" ADD CONSTRAINT "learning_item_progress_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "learning_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_progress" ADD CONSTRAINT "learning_path_progress_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "learning_path_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
