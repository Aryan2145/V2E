/**
 * Restores the committed data snapshot (`prisma/seed-data.sql`) into the database
 * so a fresh clone gets the same test data: `git pull` → `prisma migrate deploy`
 * → `prisma db seed`.
 *
 * The snapshot is a data-only, column-insert dump. We disable FK triggers
 * (`session_replication_role = replica`) for the load so insert order / circular
 * FKs don't matter, and TRUNCATE first so re-running is idempotent.
 *
 * Regenerate the snapshot from your current DB with:
 *   pg_dump "$DATABASE_URL" --data-only --column-inserts --no-owner \
 *     --no-privileges --exclude-table=_prisma_migrations -f prisma/seed-data.sql
 *
 * Requires a superuser DB role (to set session_replication_role) — fine for local
 * dev where the role is `postgres`. The original hand-written baseline seed is
 * still available via `npm run db:seed:baseline`.
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const rawUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://postgres:postgres@localhost:5432/orgos?schema=public';
const needsSsl = rawUrl.includes('sslmode');
const connectionString = needsSsl ? rawUrl.replace(/[?&]sslmode=[^&]*/g, '') : rawUrl;

async function main() {
  const sqlPath = path.join(__dirname, 'seed-data.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ Snapshot not found: ${sqlPath}`);
    process.exit(1);
  }
  // Strip psql meta-commands (e.g. pg_dump 18's `\restrict` / `\unrestrict`),
  // which aren't valid SQL when sent through the pg client.
  const sql = fs
    .readFileSync(sqlPath, 'utf8')
    .split('\n')
    .filter((line) => !line.startsWith('\\'))
    .join('\n');

  const client = new Client({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    const tables = rows.map((r) => `"public"."${r.tablename}"`);
    console.log(`🌱 Restoring snapshot into ${rows.length} tables...`);

    await client.query('BEGIN');
    await client.query("SET session_replication_role = 'replica'"); // disable FK triggers
    if (tables.length) {
      await client.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
    }
    await client.query(sql); // the data-only dump (INSERT statements)
    await client.query("SET session_replication_role = 'origin'");
    await client.query('COMMIT');
    console.log('✅ Snapshot restored.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Restore failed:', err);
  process.exit(1);
});
