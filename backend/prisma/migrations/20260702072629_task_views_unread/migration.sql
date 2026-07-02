-- CreateTable
CREATE TABLE "task_views" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_views_user_id_idx" ON "task_views"("user_id");

-- CreateIndex
CREATE INDEX "task_views_organization_id_idx" ON "task_views"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_views_task_id_user_id_key" ON "task_views"("task_id", "user_id");

-- AddForeignKey
ALTER TABLE "task_views" ADD CONSTRAINT "task_views_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
