-- Holiday management is now governed by central access rights (System Role leaves
-- holidays.org.manage / holidays.department.manage / holidays.individual.manage).
-- The old per-scope role arrays on holiday_masters were dead, unenforced config — drop them.
ALTER TABLE "holiday_masters" DROP COLUMN IF EXISTS "org_holiday_manage_roles";
ALTER TABLE "holiday_masters" DROP COLUMN IF EXISTS "dept_holiday_manage_roles";
ALTER TABLE "holiday_masters" DROP COLUMN IF EXISTS "individual_holiday_manage_roles";
