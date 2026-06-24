-- AlterTable
ALTER TABLE "assignee_cross_dept_bridges" ADD COLUMN     "include_sub_departments" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "assignee_unify_subtree" BOOLEAN NOT NULL DEFAULT false;
