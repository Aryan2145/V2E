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
 * Enforces foundational Access Rights declared via @RequirePermission.
 * Apply after JwtAuthGuard and OrgScopeGuard. Fails loud — on any deny or
 * ambiguity it throws, never silently widening access.
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

    const allowed = await this.permissions.hasPermission(
      orgId,
      user.role ?? null,
      !!user.isSuperAdmin,
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
