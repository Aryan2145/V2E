/*
  Warnings:

  - You are about to drop the column `proof_submitted_at` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `proof_url` on the `tasks` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ProofVisibility" AS ENUM ('private', 'everyone');

-- AlterTable
ALTER TABLE "task_attachments" ADD COLUMN     "is_proof" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proof_visibility" "ProofVisibility";

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "proof_submitted_at",
DROP COLUMN "proof_url",
ADD COLUMN     "proof_allowed_extensions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "task_attachments_task_id_is_proof_idx" ON "task_attachments"("task_id", "is_proof");
