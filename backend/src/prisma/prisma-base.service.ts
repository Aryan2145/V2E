import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * The raw, un-extended Prisma client. Owns the connection lifecycle.
 *
 * Application services do NOT inject this directly — they inject `PrismaService`,
 * which is the same connection wrapped with the audit `$extends` capture hook.
 * This base client is used where extension recursion must be avoided: the
 * extension's own prior-row reads, the audit writer, and label enrichment.
 */
@Injectable()
export class PrismaBaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const rawUrl = process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/V2E?schema=public';
    const needsSsl = rawUrl.includes('sslmode');
    const connectionString = needsSsl ? rawUrl.replace(/[?&]sslmode=[^&]*/g, '') : rawUrl;
    const adapter = new PrismaPg({
      connectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
