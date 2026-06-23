import { Global, Module } from '@nestjs/common';
import { PrismaBaseService } from './prisma-base.service';
import { PrismaService } from './prisma.service';
import { auditExtension } from './audit.extension';
import { AuditContextService } from '../common/cls/audit-context.service';

/**
 * Provides two Prisma clients off the SAME connection:
 *  - PrismaBaseService — raw client (owns lifecycle; used by the audit extension's
 *    prior-row reads, the writer, and label enrichment to avoid recursion).
 *  - PrismaService — the base client wrapped with the audit capture extension.
 *    This is what every application service injects, so all mutations are audited
 *    transparently with no per-module wiring.
 */
@Global()
@Module({
  providers: [
    PrismaBaseService,
    {
      provide: PrismaService,
      useFactory: (base: PrismaBaseService, ctx: AuditContextService) =>
        base.$extends(auditExtension(base, ctx)) as unknown as PrismaService,
      inject: [PrismaBaseService, AuditContextService],
    },
  ],
  exports: [PrismaService, PrismaBaseService],
})
export class PrismaModule {}
