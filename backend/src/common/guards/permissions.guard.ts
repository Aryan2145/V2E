import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSION_KEY,
  RequiredPermission,
} from '../decorators/require-permission.decorator';
import { PermissionsService } from '../../access-rights/permissions.service';

/**
 * Enforces permissions declared via @RequirePermission, resolved through the
 * four-layer model (`hasEffective`): entitlement ∩ (jobRole ∪ grants − revokes),
 * with admin leaves gated by is_admin. Apply after JwtAuthGuard and OrgScopeGuard.
 * Fails loud — on any deny it throws, never silently widening.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.params.orgId;
    if (!user) throw new ForbiddenException('Not authenticated');

    const allowed = await this.permissions.hasEffective(
      orgId,
      {
        userId: user.id,
        jobRoleId: user.job_role_id ?? null,
        isAdmin: !!user.is_admin,
        isSuperAdmin: !!user.isSuperAdmin,
      },
      required.resource,
      required.action,
    );
    if (!allowed) {
      throw new ForbiddenException(
        `You do not have ${required.action} permission on ${required.resource}`,
      );
    }
    return true;
  }
}
