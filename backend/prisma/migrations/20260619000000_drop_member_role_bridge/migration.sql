-- Drop the MemberRole bridge: authorization no longer reads it (replaced by is_admin
-- + JobRole RolePermission leaves). Legacy AccessRight (MemberRole-keyed) is superseded
-- by RolePermission/UserPermissionOverride.
DROP TABLE IF EXISTS "access_rights";
ALTER TABLE "organization_members" DROP COLUMN IF EXISTS "role";
DROP TYPE IF EXISTS "MemberRole";
