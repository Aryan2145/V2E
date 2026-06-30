/**
 * One-time backfill: seed Task Masters (config + default priorities/statuses)
 * for any existing org that never had them seeded.
 *
 * New orgs get masters seeded in OrganizationsService.create(); this covers
 * firms created before that change whose Create Task status dropdown is empty.
 *
 * Idempotent — seedTaskMasters only inserts when none exist, so re-running and
 * already-seeded orgs are no-ops. Run with: npx ts-node prisma/backfill-task-masters.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { seedTaskMasters } from '../src/task-masters/seed-task-masters';

dotenv.config({ path: path.join(__dirname, '../.env') });

const rawUrl =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/V2E?schema=public';
const needsSsl = rawUrl.includes('sslmode');
const connectionString = needsSsl ? rawUrl.replace(/[?&]sslmode=[^&]*/g, '') : rawUrl;
const adapter = new PrismaPg({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  console.log(`Found ${orgs.length} organization(s). Backfilling Task Masters...`);

  for (const org of orgs) {
    const before = await prisma.taskStatus.count({ where: { organization_id: org.id } });
    await seedTaskMasters(prisma, org.id);
    const after = await prisma.taskStatus.count({ where: { organization_id: org.id } });
    const seeded = after - before;
    console.log(
      seeded > 0
        ? `  ✓ ${org.name} (${org.id}) — seeded ${seeded} statuses + defaults`
        : `  · ${org.name} (${org.id}) — already had masters, skipped`,
    );
  }

  console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
