import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_SUPER_ADMIN_KEY } from '../decorators/super-admin.decorator';
import { REQUIRE_ADMIN_KEY } from '../decorators/require-admin.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    const requiresSuperAdmin = this.reflector.getAllAndOverride<boolean>(IS_SUPER_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiresSuperAdmin) {
      if (!user?.isSuperAdmin) throw new ForbiddenException('Super admin required');
      return true;
    }

    // Platform-admin gate (org-scoped) — is_admin only, never feature permissions.
    const requiresAdmin = this.reflector.getAllAndOverride<boolean>(REQUIRE_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiresAdmin) {
      if (!user?.isSuperAdmin && !user?.is_admin) {
        throw new ForbiddenException('Administrator access required');
      }
      return true;
    }

    return true;
  }
}
