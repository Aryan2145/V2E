import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditWriterService } from './audit-writer.service';
import { AuditEnrichmentService } from './audit-enrichment.service';
import { AuditRetentionService } from './audit-retention.service';

/**
 * Global so any module can inject AuditService / AuditWriterService without
 * importing AuditModule. The controller is gated by the foundation Access Rights
 * (PermissionsGuard).
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditWriterService, AuditEnrichmentService, AuditRetentionService],
  exports: [AuditService, AuditWriterService, AuditEnrichmentService],
})
export class AuditModule {}
