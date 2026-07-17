import { Module } from '@nestjs/common';
import { ProcessHierarchyController } from './process-hierarchy.controller';
import { ProcessHierarchyService } from './process-hierarchy.service';
import { ProcessAccessService } from './process-access.service';

/**
 * Process Hierarchy — BPMN-lite recursive process explorer.
 * PrismaModule, StorageModule (R2Service) and AccessRightsModule are global, so no
 * imports are needed. The attachment-based access engine lives in ProcessAccessService.
 */
@Module({
  controllers: [ProcessHierarchyController],
  providers: [ProcessHierarchyService, ProcessAccessService],
  exports: [ProcessHierarchyService],
})
export class ProcessHierarchyModule {}
