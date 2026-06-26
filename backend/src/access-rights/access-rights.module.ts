import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { SubjectEligibilityService } from './subject-eligibility.service';
import { ScopeService } from './scope.service';
import { AccessVisibilityService } from './access-visibility.service';
import { EligibleSubjectsController } from './eligible-subjects.controller';
import { PermissionAdminController } from './permission-admin.controller';
import { AccessVisibilityController } from './access-visibility.controller';
import { PermissionAdminService } from './permission-admin.service';

/**
 * Global so PermissionsService + SubjectEligibilityService + ScopeService +
 * AccessVisibilityService (used by guards and by every module's create/assign/list
 * paths) are injectable everywhere without importing this module.
 */
@Global()
@Module({
  controllers: [EligibleSubjectsController, PermissionAdminController, AccessVisibilityController],
  providers: [
    PermissionsService,
    SubjectEligibilityService,
    ScopeService,
    AccessVisibilityService,
    PermissionAdminService,
  ],
  exports: [PermissionsService, SubjectEligibilityService, ScopeService, AccessVisibilityService],
})
export class AccessRightsModule {}
