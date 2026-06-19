import { SetMetadata } from '@nestjs/common';
import { PermissionAction } from '@prisma/client';
import { isValidLeaf } from '../../access-rights/permission-registry';

export const PERMISSION_KEY = 'required_permission';

export interface RequiredPermission {
  resource: string;
  action: PermissionAction;
}

/**
 * Gate an endpoint behind a permission leaf.
 * Use together with JwtAuthGuard, OrgScopeGuard and PermissionsGuard.
 *
 * The leaf key is validated against the permission registry at decoration time
 * (module load), so a typo fails loud at startup rather than silently allowing.
 *
 * @example @RequirePermission('goals', PermissionAction.edit)
 */
export const RequirePermission = (resource: string, action: PermissionAction) => {
  if (!isValidLeaf(resource)) {
    throw new Error(
      `@RequirePermission("${resource}", ...) references an unknown permission leaf. ` +
        `Add it to the permission registry (permission-registry.ts).`,
    );
  }
  return SetMetadata(PERMISSION_KEY, { resource, action } as RequiredPermission);
};
