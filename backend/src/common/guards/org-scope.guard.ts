import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

@Injectable()
export class OrgScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.params.orgId;

    if (!orgId) return true;
    if (user.role === UserRole.super_admin) return true;

    if (user.organization_id !== orgId) {
      throw new ForbiddenException('Access denied to this organization');
    }
    return true;
  }
}
