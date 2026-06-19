-- CreateEnum
CREATE TYPE "DataScope" AS ENUM ('own', 'team', 'department', 'org');

-- AlterTable
ALTER TABLE "role_permissions" ADD COLUMN     "scope" "DataScope";

-- AlterTable
ALTER TABLE "user_permission_overrides" ADD COLUMN     "scope" "DataScope";
