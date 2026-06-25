/*
  Warnings:

  - You are about to drop the `assignee_visibility_exception_members` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `assignee_visibility_exceptions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "assignee_visibility_exception_members" DROP CONSTRAINT "assignee_visibility_exception_members_exception_id_fkey";

-- DropTable
DROP TABLE "assignee_visibility_exception_members";

-- DropTable
DROP TABLE "assignee_visibility_exceptions";

-- DropEnum
DROP TYPE "AssigneeExceptionKind";

-- DropEnum
DROP TYPE "AssigneeExceptionScope";
