import { BadRequestException, Injectable } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ACCESS_RESOURCES,
  ACCESS_RIGHTS_RESOURCE,
  CONFIGURABLE_ROLES,
} from './access-rights.constants';
import { UpdateAccessRightsDto } from './dto/update-access-rights.dto';

@Injectable()
export class AccessRightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The full configurable matrix: every resource × every configurable role, with
   * missing rows defaulting to all-false. org_admin is reported as locked-all so
   * the UI can show it disabled.
   */
  async getMatrix(orgId: string) {
    const rows = await this.prisma.accessRight.findMany({
      where: { organization_id: orgId },
    });
    const byKey = new Map(rows.map((r) => [`${r.role}:${r.resource}`, r]));

    const matrix = CONFIGURABLE_ROLES.map((role) => ({
      role,
      resources: ACCESS_RESOURCES.map((res) => {
        const row = byKey.get(`${role}:${res.key}`);
        return {
          resource: res.key,
          label: res.label,
          description: res.description,
          can_read: row?.can_read ?? false,
          can_write: row?.can_write ?? false,
          can_edit: row?.can_edit ?? false,
          can_delete: row?.can_delete ?? false,
        };
      }),
    }));

    return {
      resources: ACCESS_RESOURCES,
      roles: CONFIGURABLE_ROLES,
      matrix,
      admin: { role: 'org_admin', locked: true, note: 'Administrators always have all rights.' },
    };
  }

  async updateMatrix(orgId: string, actorId: string, dto: UpdateAccessRightsDto) {
    const validResources = new Set(ACCESS_RESOURCES.map((r) => r.key));
    const validRoles = new Set<string>(CONFIGURABLE_ROLES);

    for (const entry of dto.entries) {
      if (!validRoles.has(entry.role)) {
        throw new BadRequestException(`Role "${entry.role}" is not configurable`);
      }
      if (!validResources.has(entry.resource)) {
        throw new BadRequestException(`Unknown resource "${entry.resource}"`);
      }
    }

    for (const entry of dto.entries) {
      const role = entry.role as MemberRole;
      const before = await this.prisma.accessRight.findUnique({
        where: {
          organization_id_role_resource: {
            organization_id: orgId,
            role,
            resource: entry.resource,
          },
        },
      });

      const data = {
        can_read: entry.can_read,
        can_write: entry.can_write,
        can_edit: entry.can_edit,
        can_delete: entry.can_delete,
        updated_by_user_id: actorId,
      };

      const after = await this.prisma.accessRight.upsert({
        where: {
          organization_id_role_resource: {
            organization_id: orgId,
            role,
            resource: entry.resource,
          },
        },
        create: { organization_id: orgId, role, resource: entry.resource, ...data },
        update: data,
      });

      const changes = this.audit.diff(
        before ?? { can_read: false, can_write: false, can_edit: false, can_delete: false },
        after,
        ['can_read', 'can_write', 'can_edit', 'can_delete'],
      );
      if (changes) {
        await this.audit.record({
          orgId,
          actorId,
          action: before ? 'update' : 'create',
          resource: 'access_right',
          entityId: after.id,
          entityLabel: `${entry.role} · ${entry.resource}`,
          changes,
        });
      }
    }

    return this.getMatrix(orgId);
  }

  /** The current principal's own permissions across all resources (for UI gating). */
  async getMyPermissions(
    orgId: string,
    role: MemberRole | null,
    isSuperAdmin: boolean,
  ) {
    const result: Record<string, { read: boolean; write: boolean; edit: boolean; delete: boolean }> = {};
    const adminAll = isSuperAdmin || role === 'org_admin';
    const rows = adminAll
      ? []
      : role
        ? await this.prisma.accessRight.findMany({ where: { organization_id: orgId, role } })
        : [];
    const byResource = new Map(rows.map((r) => [r.resource, r]));

    for (const res of ACCESS_RESOURCES) {
      if (adminAll) {
        result[res.key] = { read: true, write: true, edit: true, delete: true };
      } else {
        const r = byResource.get(res.key);
        result[res.key] = {
          read: r?.can_read ?? false,
          write: r?.can_write ?? false,
          edit: r?.can_edit ?? false,
          delete: r?.can_delete ?? false,
        };
      }
    }
    return { resources: result, can_manage_access_rights: result[ACCESS_RIGHTS_RESOURCE].edit };
  }
}
