import { Injectable } from '@nestjs/common';
import { MemberRole, PermissionAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ResourcePermissions {
  read: boolean;
  write: boolean;
  edit: boolean;
  delete: boolean;
}

const ALL: ResourcePermissions = { read: true, write: true, edit: true, delete: true };
const NONE: ResourcePermissions = { read: false, write: false, edit: false, delete: false };

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a principal's permissions on a resource.
   * Super admins and org_admin have ALL rights (and cannot be locked out — their
   * rows are never stored). Everyone else is resolved from the AccessRight table;
   * a missing row means NO rights (fail-closed).
   */
  async getPermissions(
    orgId: string,
    role: MemberRole | null,
    isSuperAdmin: boolean,
    resource: string,
  ): Promise<ResourcePermissions> {
    if (isSuperAdmin || role === 'org_admin') return ALL;
    if (!role) return NONE;

    const row = await this.prisma.accessRight.findUnique({
      where: {
        organization_id_role_resource: {
          organization_id: orgId,
          role,
          resource,
        },
      },
    });
    if (!row) return NONE;
    return {
      read: row.can_read,
      write: row.can_write,
      edit: row.can_edit,
      delete: row.can_delete,
    };
  }

  /** True only when the principal explicitly holds `action` on `resource`. */
  async hasPermission(
    orgId: string,
    role: MemberRole | null,
    isSuperAdmin: boolean,
    resource: string,
    action: PermissionAction,
  ): Promise<boolean> {
    const perms = await this.getPermissions(orgId, role, isSuperAdmin, resource);
    return perms[action];
  }
}
