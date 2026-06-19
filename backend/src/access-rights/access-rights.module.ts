import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { SubjectEligibilityService } from './subject-eligibility.service';
import { ScopeService } from './scope.service';
import { EligibleSubjectsController } from './eligible-subjects.controller';
import { PermissionAdminController } from './permission-admin.controller';
import { PermissionAdminService } from './permission-admin.service';

/**
 * Global so PermissionsService + SubjectEligibilityService + ScopeService (used by
 * guards and by every module's create/assign/list paths) are injectable everywhere
 * without importing this module.
 */
@Global()
@Module({
  controllers: [EligibleSubjectsController, PermissionAdminController],
  providers: [PermissionsService, SubjectEligibilityService, ScopeService, PermissionAdminService],
  exports: [PermissionsService, SubjectEligibilityService, ScopeService],
})
export class AccessRightsModule {}
