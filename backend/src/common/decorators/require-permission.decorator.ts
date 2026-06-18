import { SetMetadata } from '@nestjs/common';
import { PermissionAction } from '@prisma/client';

export const PERMISSION_KEY = 'required_permission';

export interface RequiredPermission {
  resource: string;
  action: PermissionAction;
}

/**
 * Gate an endpoint behind a foundational Access Right.
 * Use together with JwtAuthGuard, OrgScopeGuard and PermissionsGuard.
 *
 * @example @RequirePermission('goals', PermissionAction.edit)
 */
export const RequirePermission = (resource: string, action: PermissionAction) =>
  SetMetadata(PERMISSION_KEY, { resource, action } as RequiredPermission);
