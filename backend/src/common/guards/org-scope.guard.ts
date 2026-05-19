import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class OrgScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.params.orgId;

    if (!orgId) return true;
    if (user.isSuperAdmin) return true;

    if (user.organizationId !== orgId) {
      throw new ForbiddenException('Access denied to this organization');
    }
    return true;
  }
}
