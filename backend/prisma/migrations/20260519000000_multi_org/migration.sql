-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('org_admin', 'hr_manager', 'employee');

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- Migrate existing user-org relationships into organization_members
INSERT INTO "organization_members" ("id", "organization_id", "user_id", "role", "is_active", "joined_at")
SELECT
    gen_random_uuid()::text,
    "organization_id",
    "id",
    "role"::text::"MemberRole",
    "is_active",
    "created_at"
FROM "users"
WHERE "organization_id" IS NOT NULL
  AND "role" <> 'super_admin';

-- Add is_super_admin column to users
ALTER TABLE "users" ADD COLUMN "is_super_admin" BOOLEAN NOT NULL DEFAULT false;

-- Mark super admins
UPDATE "users" SET "is_super_admin" = true WHERE "role" = 'super_admin';

-- CreateIndex for organization_members uniqueness
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- AddForeignKey for organization_members -> organizations
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey for organization_members -> users
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropIndex (old composite unique on email + organization_id)
ALTER TABLE "users" DROP CONSTRAINT "users_email_organization_id_key";

-- DropColumn organization_id from users
ALTER TABLE "users" DROP COLUMN "organization_id";

-- DropColumn role from users
ALTER TABLE "users" DROP COLUMN "role";

-- CreateIndex (new globally unique email)
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- DropEnum (UserRole no longer used)
DROP TYPE "UserRole";
