import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedDefaultSystemRoles } from '../src/access-rights/default-system-roles';

const rawUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://postgres:postgres@localhost:5432/orgos?schema=public';
const needsSsl = rawUrl.includes('sslmode');
const connectionString = needsSsl ? rawUrl.replace(/[?&]sslmode=[^&]*/g, '') : rawUrl;
const adapter = new PrismaPg({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  console.log(`🌱 Backfilling default system roles for ${orgs.length} org(s)...`);
  for (const org of orgs) {
    // One transaction per org keeps each org's seed atomic.
    const res = await prisma.$transaction((tx) => seedDefaultSystemRoles(tx, org.id));
    console.log(
      `  ${org.name}: created [${res.created.join(', ') || '-'}], skipped [${res.skipped.join(', ') || '-'}]`,
    );
  }
  console.log('✅ Done.');
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
