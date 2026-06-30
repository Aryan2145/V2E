-- Preserve existing workflow access while making it independently configurable.
INSERT INTO "org_module_entitlements" (
  "id",
  "organization_id",
  "module_key",
  "state",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  o."id",
  'workflows',
  'full'::"EntitlementState",
  now(),
  now()
FROM "organizations" o
ON CONFLICT ("organization_id", "module_key") DO NOTHING;
