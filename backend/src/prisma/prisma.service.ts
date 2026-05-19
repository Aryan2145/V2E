import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
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
