/**
 * Backfill the Process Hierarchy module for EXISTING orgs.
 *
 * New orgs get this automatically (entitlement seeded to `full` on creation, and the
 * default System Roles now include the process_hierarchy grant). Existing orgs need:
 *   1. an OrgModuleEntitlement row `process_hierarchy` = full, and
 *   2. RWE (read/write/edit — NO delete) RolePermission rows on every non-admin,
 *      non-system SystemRole, so their members are Contributors.
 *
 * Idempotent — safe to re-run. Run with:
 *   npx ts-node prisma/backfill-process-hierarchy.ts
 */
import { PrismaClient, PermissionAction, EntitlementState } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

function makeClient(): PrismaClient {
  const rawUrl =
    process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/orgos?schema=public';
  const needsSsl = rawUrl.includes('sslmode');
  const connectionString = needsSsl ? rawUrl.replace(/[?&]sslmode=[^&]*/g, '') : rawUrl;
  const adapter = new PrismaPg({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  return new PrismaClient({ adapter });
}

const LEAF = 'process_hierarchy.map.manage';
const MODULE_KEY = 'process_hierarchy';
const RWE: PermissionAction[] = [
  PermissionAction.read,
  PermissionAction.write,
  PermissionAction.edit,
];

async function main() {
  const prisma = makeClient();
  try {
    const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
    console.log(`Found ${orgs.length} organization(s).`);

    for (const org of orgs) {
      // 1. Entitlement ceiling → full.
      await prisma.orgModuleEntitlement.upsert({
        where: { organization_id_module_key: { organization_id: org.id, module_key: MODULE_KEY } },
        create: { organization_id: org.id, module_key: MODULE_KEY, state: EntitlementState.full },
        update: { state: EntitlementState.full },
      });

      // 2. Grant RWE to every non-admin, non-system role (they become Contributors).
      const roles = await prisma.systemRole.findMany({
        where: { organization_id: org.id, is_admin: false, is_system: false },
        select: { id: true },
      });
      let grants = 0;
      for (const role of roles) {
        for (const action of RWE) {
          await prisma.rolePermission.upsert({
            where: {
              organization_id_system_role_id_feature_key_action: {
                organization_id: org.id,
                system_role_id: role.id,
                feature_key: LEAF,
                action,
              },
            },
            create: {
              organization_id: org.id,
              system_role_id: role.id,
              feature_key: LEAF,
              action,
              allowed: true,
              scope: null,
            },
            update: {}, // never clobber an admin-customized grant
          });
          grants++;
        }
      }
      console.log(`  ✓ ${org.name}: entitlement=full, ${roles.length} role(s) granted (${grants} rows)`);
    }
    console.log('Backfill complete.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
