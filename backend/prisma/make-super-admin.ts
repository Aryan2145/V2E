import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const rawUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://postgres:postgres@localhost:5432/orgos?schema=public';
const needsSsl = rawUrl.includes('sslmode');
const connectionString = needsSsl ? rawUrl.replace(/[?&]sslmode=[^&]*/g, '') : rawUrl;

// Pass the target email as a CLI arg, e.g.
//   npx ts-node prisma/make-super-admin.ts superadmin@V2E.io
// Falls back to the default account when no arg is given.
const EMAIL = process.argv[2] ?? 'aryan@rgbindia.com';

async function main() {
  const client = new Client({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    console.log(`🔑 Granting Super Admin privileges to ${EMAIL}...`);
    
    const { rows } = await client.query(
      `UPDATE "public"."users" 
       SET is_super_admin = true 
       WHERE email = $1
       RETURNING id, name, email, is_super_admin`,
      [EMAIL]
    );

    if (rows.length === 0) {
      throw new Error(`Failed to update user. User with email ${EMAIL} not found.`);
    }

    console.log(`✅ Admin user upgraded to Super Admin successfully:`);
    console.log(`  - Name: ${rows[0].name}`);
    console.log(`  - Email: ${rows[0].email}`);
    console.log(`  - Is Super Admin: ${rows[0].is_super_admin}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Upgrade failed:', err);
  process.exit(1);
});
