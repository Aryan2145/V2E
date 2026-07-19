-- CreateIndex
CREATE INDEX "learning_items_path_id_order_index_idx" ON "learning_items"("path_id", "order_index");

-- CreateIndex
CREATE INDEX "learning_paths_organization_id_status_role_id_idx" ON "learning_paths"("organization_id", "status", "role_id");
