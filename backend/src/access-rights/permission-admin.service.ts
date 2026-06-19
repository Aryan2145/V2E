import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataScope, OverrideEffect, PermissionAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Principal, PermissionsService, ResourcePermissions } from './permissions.service';
import {
  ALL_FEATURE_LEAVES,
  ALL_SUBJECT_LEAVES,
  PERMISSION_REGISTRY,
  isValidLeaf,
  supportsAction,
  axisOf,
  kindOf,
} from './permission-registry';
import { isContentLeaf, rowScopeOf } from './scope-registry';

const NONE: ResourcePermissions = { read: false, write: false, edit: false, delete: false };

interface RolePermissionEntry {
  job_role_id: string;
  feature_key: string;
  action: PermissionAction;
  allowed: boolean;
  scope?: DataScope | null;
}

@Injectable()
export class PermissionAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: PermissionsService,
  ) {}

  /** The permission tree for the UI to render (actor-feature leaves + subject leaves). */
  getRegistry() {
    return {
      modules: PERMISSION_REGISTRY.map((m) => ({
        key: m.key,
        label: m.label,
        entitlementControlled: m.entitlementControlled,
        subModules: m.subModules.map((s) => ({
          key: s.key,
          label: s.label,
          features: s.features.map((f) => ({
            key: f.key,
            label: f.label,
            description: f.description,
            axis: f.axis,
            kind: f.kind,
            actions: f.actions,
          })),
        })),
      })),
    };
  }

  // ─── JobRole permission matrix (Layer 2) ─────────────────────────────────────

  async getRoleMatrix(orgId: string) {
    const [roles, rows] = await Promise.all([
      this.prisma.role.findMany({
        where: { organization_id: orgId },
        include: { department: { select: { id: true, name: true } } },
        orderBy: [{ department: { name: 'asc' } }, { title: 'asc' }],
      }),
      this.prisma.rolePermission.findMany({ where: { organization_id: orgId } }),
    ]);

    const allow = new Map(rows.map((r) => [`${r.job_role_id}:${r.feature_key}:${r.action}`, r.allowed]));
    const scopeAt = new Map(rows.map((r) => [`${r.job_role_id}:${r.feature_key}:${r.action}`, r.scope]));
    const permissions: Record<string, Record<string, ResourcePermissions>> = {};
    // scopes[roleId][leafKey][action] = DataScope — only for scopable content leaves.
    const scopes: Record<string, Record<string, Partial<Record<PermissionAction, DataScope>>>> = {};
    for (const role of roles) {
      const perLeaf: Record<string, ResourcePermissions> = {};
      const perLeafScope: Record<string, Partial<Record<PermissionAction, DataScope>>> = {};
      for (const leaf of ALL_FEATURE_LEAVES) {
        perLeaf[leaf.key] = {
          read: leaf.actions.includes('read') ? allow.get(`${role.id}:${leaf.key}:read`) ?? false : false,
          write: leaf.actions.includes('write') ? allow.get(`${role.id}:${leaf.key}:write`) ?? false : false,
          edit: leaf.actions.includes('edit') ? allow.get(`${role.id}:${leaf.key}:edit`) ?? false : false,
          delete: leaf.actions.includes('delete') ? allow.get(`${role.id}:${leaf.key}:delete`) ?? false : false,
        };
        if (rowScopeOf(leaf.key) === 'scopable') {
          const perAction: Partial<Record<PermissionAction, DataScope>> = {};
          for (const action of leaf.actions) {
            const s = scopeAt.get(`${role.id}:${leaf.key}:${action}`);
            if (s) perAction[action] = s;
          }
          perLeafScope[leaf.key] = perAction;
        }
      }
      permissions[role.id] = perLeaf;
      scopes[role.id] = perLeafScope;
    }

    return {
      jobRoles: roles.map((r) => ({
        id: r.id,
        title: r.title,
        level: r.level,
        department: r.department ? { id: r.department.id, name: r.department.name } : null,
      })),
      permissions,
      scopes,
      scopableLeaves: ALL_FEATURE_LEAVES.filter((l) => rowScopeOf(l.key) === 'scopable').map((l) => l.key),
    };
  }

  async updateRoleMatrix(orgId: string, actorId: string, entries: RolePermissionEntry[]) {
    // Validate before writing anything (fail loud, atomic-ish).
    const roleIds = new Set((await this.prisma.role.findMany({ where: { organization_id: orgId }, select: { id: true } })).map((r) => r.id));
    for (const e of entries) {
      if (!roleIds.has(e.job_role_id)) throw new BadRequestException(`Unknown job role "${e.job_role_id}"`);
      if (!isValidLeaf(e.feature_key) || axisOf(e.feature_key) !== 'actor') {
        throw new BadRequestException(`Unknown feature "${e.feature_key}"`);
      }
      // Admin-permanence: admin leaves are resolver-derived (is_admin) and never stored.
      if (kindOf(e.feature_key) === 'admin') {
        throw new BadRequestException(
          `"${e.feature_key}" is a core admin permission and cannot be configured here.`,
        );
      }
      if (!supportsAction(e.feature_key, e.action)) {
        throw new BadRequestException(`Feature "${e.feature_key}" does not support action "${e.action}"`);
      }
    }

    for (const e of entries) {
      // Scope only applies to scopable content leaves; ignore it elsewhere.
      const scope = rowScopeOf(e.feature_key) === 'scopable' ? e.scope ?? null : null;
      const before = await this.prisma.rolePermission.findUnique({
        where: {
          organization_id_job_role_id_feature_key_action: {
            organization_id: orgId,
            job_role_id: e.job_role_id,
            feature_key: e.feature_key,
            action: e.action,
          },
        },
      });
      if ((before?.allowed ?? false) === e.allowed && (before?.scope ?? null) === scope) continue; // no-op

      await this.prisma.rolePermission.upsert({
        where: {
          organization_id_job_role_id_feature_key_action: {
            organization_id: orgId,
            job_role_id: e.job_role_id,
            feature_key: e.feature_key,
            action: e.action,
          },
        },
        create: {
          organization_id: orgId,
          job_role_id: e.job_role_id,
          feature_key: e.feature_key,
          action: e.action,
          allowed: e.allowed,
          scope,
          updated_by_user_id: actorId,
        },
        update: { allowed: e.allowed, scope, updated_by_user_id: actorId },
      });

      await this.audit.record({
        orgId,
        actorId,
        action: before ? 'update' : 'create',
        resource: 'role_permission',
        entityId: `${e.job_role_id}:${e.feature_key}:${e.action}`,
        entityLabel: `${e.feature_key} · ${e.action}`,
        changes: {
          allowed: { before: before?.allowed ?? false, after: e.allowed },
          scope: { before: before?.scope ?? null, after: scope },
        },
      });
    }

    return this.getRoleMatrix(orgId);
  }

  // ─── Subject eligibility org defaults ────────────────────────────────────────

  async getSubjectPolicies(orgId: string) {
    const rows = await this.prisma.subjectEligibilityPolicy.findMany({ where: { organization_id: orgId } });
    const byKey = new Map(rows.map((r) => [r.subject_key, r.default_eligible]));
    return {
      policies: ALL_SUBJECT_LEAVES.map((leaf) => ({
        subject_key: leaf.key,
        label: leaf.label,
        default_eligible: byKey.get(leaf.key) ?? true,
      })),
    };
  }

  async updateSubjectPolicies(
    orgId: string,
    actorId: string,
    entries: { subject_key: string; default_eligible: boolean }[],
  ) {
    for (const e of entries) {
      if (!isValidLeaf(e.subject_key) || axisOf(e.subject_key) !== 'subject') {
        throw new BadRequestException(`Unknown subject permission "${e.subject_key}"`);
      }
    }
    for (const e of entries) {
      const before = await this.prisma.subjectEligibilityPolicy.findUnique({
        where: { organization_id_subject_key: { organization_id: orgId, subject_key: e.subject_key } },
      });
      if ((before?.default_eligible ?? true) === e.default_eligible) continue;
      await this.prisma.subjectEligibilityPolicy.upsert({
        where: { organization_id_subject_key: { organization_id: orgId, subject_key: e.subject_key } },
        create: { organization_id: orgId, subject_key: e.subject_key, default_eligible: e.default_eligible, updated_by_user_id: actorId },
        update: { default_eligible: e.default_eligible, updated_by_user_id: actorId },
      });
      await this.audit.record({
        orgId,
        actorId,
        action: before ? 'update' : 'create',
        resource: 'subject_policy',
        entityId: e.subject_key,
        entityLabel: e.subject_key,
        changes: { default_eligible: { before: before?.default_eligible ?? true, after: e.default_eligible } },
      });
    }
    return this.getSubjectPolicies(orgId);
  }

  // ─── Per-user view + overrides (Layer 3) ─────────────────────────────────────

  private async principalForUser(orgId: string, userId: string): Promise<Principal & { jobRoleTitle: string | null }> {
    const [profile, member, user] = await Promise.all([
      this.prisma.employeeProfile.findFirst({
        where: { organization_id: orgId, user_id: userId },
        include: { role: { select: { id: true, title: true } } },
      }),
      this.prisma.organizationMember.findUnique({
        where: { organization_id_user_id: { organization_id: orgId, user_id: userId } },
        select: { is_admin: true },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { is_super_admin: true } }),
    ]);
    return {
      userId,
      jobRoleId: profile?.role_id ?? null,
      jobRoleTitle: profile?.role?.title ?? null,
      isAdmin: member?.is_admin ?? false,
      isSuperAdmin: user?.is_super_admin ?? false,
    };
  }

  /** Inherited (from job role) + overrides + effective, per feature leaf, for the employee panel. */
  async getUserPermissions(orgId: string, userId: string) {
    const principal = await this.principalForUser(orgId, userId);

    const [baseRows, overrideRows, subjectOverrides] = await Promise.all([
      principal.jobRoleId
        ? this.prisma.rolePermission.findMany({ where: { organization_id: orgId, job_role_id: principal.jobRoleId } })
        : Promise.resolve([]),
      this.prisma.userPermissionOverride.findMany({ where: { organization_id: orgId, user_id: userId } }),
      this.prisma.userSubjectOverride.findMany({ where: { organization_id: orgId, user_id: userId } }),
    ]);
    const baseAllow = new Map(baseRows.map((r) => [`${r.feature_key}:${r.action}`, r.allowed]));
    const overrideMap = new Map(overrideRows.map((r) => [`${r.feature_key}:${r.action}`, r.effect]));
    const overrideScope = new Map(overrideRows.map((r) => [`${r.feature_key}:${r.action}`, r.scope]));

    const [effective, effectiveScopes] = await Promise.all([
      this.permissions.resolveEffectiveForUser(orgId, principal),
      this.permissions.resolveScopesForUser(orgId, principal),
    ]);

    const actionsBlock = (leafKey: string, src: (a: PermissionAction) => boolean): ResourcePermissions => ({
      read: src('read'),
      write: src('write'),
      edit: src('edit'),
      delete: src('delete'),
    });

    const leaves = ALL_FEATURE_LEAVES.map((leaf) => ({
      key: leaf.key,
      inherited: actionsBlock(leaf.key, (a) =>
        leaf.actions.includes(a) ? baseAllow.get(`${leaf.key}:${a}`) ?? false : false,
      ),
      overrides: {
        read: overrideMap.get(`${leaf.key}:read`) ?? null,
        write: overrideMap.get(`${leaf.key}:write`) ?? null,
        edit: overrideMap.get(`${leaf.key}:edit`) ?? null,
        delete: overrideMap.get(`${leaf.key}:delete`) ?? null,
      } as Record<PermissionAction, OverrideEffect | null>,
      scopable: rowScopeOf(leaf.key) === 'scopable',
      override_scopes: {
        read: overrideScope.get(`${leaf.key}:read`) ?? null,
        write: overrideScope.get(`${leaf.key}:write`) ?? null,
        edit: overrideScope.get(`${leaf.key}:edit`) ?? null,
        delete: overrideScope.get(`${leaf.key}:delete`) ?? null,
      } as Record<PermissionAction, DataScope | null>,
      effective_scopes: effectiveScopes[leaf.key] ?? {},
      effective: effective[leaf.key] ?? NONE,
    }));

    const subjectByKey = new Map(subjectOverrides.map((s) => [s.subject_key, s.effect]));

    return {
      user_id: userId,
      job_role: principal.jobRoleId ? { id: principal.jobRoleId, title: principal.jobRoleTitle } : null,
      is_admin: principal.isAdmin,
      is_super_admin: principal.isSuperAdmin,
      leaves,
      subject_overrides: ALL_SUBJECT_LEAVES.map((leaf) => ({
        subject_key: leaf.key,
        label: leaf.label,
        override: subjectByKey.get(leaf.key) ?? null,
      })),
    };
  }

  async setUserOverride(
    orgId: string,
    actorId: string,
    userId: string,
    feature_key: string,
    action: PermissionAction,
    effect: OverrideEffect | null,
    scope?: DataScope | null,
    reason?: string,
  ) {
    if (!isValidLeaf(feature_key) || axisOf(feature_key) !== 'actor') {
      throw new BadRequestException(`Unknown feature "${feature_key}"`);
    }
    if (kindOf(feature_key) === 'admin') {
      throw new BadRequestException(
        `"${feature_key}" is a core admin permission and cannot be overridden per user.`,
      );
    }
    if (!supportsAction(feature_key, action)) {
      throw new BadRequestException(`Feature "${feature_key}" does not support action "${action}"`);
    }
    await this.ensureMember(orgId, userId);
    const effScope = rowScopeOf(feature_key) === 'scopable' ? scope ?? null : null;

    const where = {
      organization_id_user_id_feature_key_action: {
        organization_id: orgId,
        user_id: userId,
        feature_key,
        action,
      },
    };
    const before = await this.prisma.userPermissionOverride.findUnique({ where });

    if (effect === null) {
      if (before) {
        await this.prisma.userPermissionOverride.delete({ where });
        await this.audit.record({
          orgId, actorId, action: 'delete', resource: 'user_permission_override',
          entityId: `${userId}:${feature_key}:${action}`, entityLabel: `${feature_key} · ${action}`,
          changes: { effect: { before: before.effect, after: null } },
        });
      }
    } else {
      await this.prisma.userPermissionOverride.upsert({
        where,
        create: { organization_id: orgId, user_id: userId, feature_key, action, effect, scope: effScope, reason, updated_by_user_id: actorId },
        update: { effect, scope: effScope, reason, updated_by_user_id: actorId },
      });
      await this.audit.record({
        orgId, actorId, action: before ? 'update' : 'create', resource: 'user_permission_override',
        entityId: `${userId}:${feature_key}:${action}`, entityLabel: `${feature_key} · ${action}`,
        changes: { effect: { before: before?.effect ?? null, after: effect }, scope: { before: before?.scope ?? null, after: effScope } },
      });
    }
    return this.getUserPermissions(orgId, userId);
  }

  async setUserSubjectOverride(
    orgId: string,
    actorId: string,
    userId: string,
    subject_key: string,
    effect: OverrideEffect | null,
    reason?: string,
  ) {
    if (!isValidLeaf(subject_key) || axisOf(subject_key) !== 'subject') {
      throw new BadRequestException(`Unknown subject permission "${subject_key}"`);
    }
    await this.ensureMember(orgId, userId);

    const where = {
      organization_id_user_id_subject_key: { organization_id: orgId, user_id: userId, subject_key },
    };
    const before = await this.prisma.userSubjectOverride.findUnique({ where });

    if (effect === null) {
      if (before) {
        await this.prisma.userSubjectOverride.delete({ where });
        await this.audit.record({
          orgId, actorId, action: 'delete', resource: 'user_subject_override',
          entityId: `${userId}:${subject_key}`, entityLabel: subject_key,
          changes: { effect: { before: before.effect, after: null } },
        });
      }
    } else {
      await this.prisma.userSubjectOverride.upsert({
        where,
        create: { organization_id: orgId, user_id: userId, subject_key, effect, reason, updated_by_user_id: actorId },
        update: { effect, reason, updated_by_user_id: actorId },
      });
      await this.audit.record({
        orgId, actorId, action: before ? 'update' : 'create', resource: 'user_subject_override',
        entityId: `${userId}:${subject_key}`, entityLabel: subject_key,
        changes: { effect: { before: before?.effect ?? null, after: effect } },
      });
    }
    return this.getUserPermissions(orgId, userId);
  }

  private async ensureMember(orgId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { organization_id_user_id: { organization_id: orgId, user_id: userId } },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('User is not a member of this organization');
  }

  // ─── Effective permissions for the current principal (/me, UI gating) ────────

  async getMyEffective(orgId: string, principal: Principal) {
    const [leaves, scopes] = await Promise.all([
      this.permissions.resolveEffectiveForUser(orgId, principal),
      this.permissions.resolveScopesForUser(orgId, principal),
    ]);
    return { leaves, scopes, is_admin: principal.isAdmin, is_super_admin: principal.isSuperAdmin };
  }
}
