import { Global, Module } from '@nestjs/common';
import { AccessRightsController } from './access-rights.controller';
import { AccessRightsService } from './access-rights.service';
import { PermissionsService } from './permissions.service';

/**
 * Global so PermissionsService (used by PermissionsGuard across every module)
 * is injectable everywhere without importing this module.
 */
@Global()
@Module({
  controllers: [AccessRightsController],
  providers: [AccessRightsService, PermissionsService],
  exports: [PermissionsService, AccessRightsService],
})
export class AccessRightsModule {}
