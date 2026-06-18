import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBridgeDto,
  CreateExceptionDto,
  SetDeptUpwardDto,
  UpdateAssigneeSettingsDto,
} from './dto/assignee-visibility.dto';

// Member roles that, by default, see everyone (full-visibility list). Distinct from
// "is an admin" — granting full visibility never confers admin powers elsewhere.
const DEFAULT_FULL_VISIBILITY_ROLES = ['org_admin', 'hr_manager'];
const SENIOR_LEVELS = new Set(['senior', 'lead', 'head']);

const GRAPH_TTL_MS = 60_000; // safety backstop; primary freshness is event invalidation
const CONFIG_TTL_MS = 5_000;

export interface ProfileLite {
  user_id: string;
  name: string;
  department_id: string;
  department_name: string;
  role_title: string;
  role_level: string;
  member_role: string | null;
  reporting_to_user_id: string | null;
}

interface VisException {
  id: string;
  scope: 'user' | 'role' | 'department';
  kind: 'widen' | 'narrow';
  shortlist: Set<string>;
}

interface OrgGraph {
  activeUserIds: string[];
  profiles: Map<string, ProfileLite>;
  deptOf: Map<string, string>;
  memberRoleOf: Map<string, string>;
  directManagerOf: Map<string, string | null>;
  childrenOf: Map<string, string[]>;
  deptMembers: Map<string, Set<string>>;
  deptSeniors: Map<string, Set<string>>; // head_user + senior/lead/head roles
  deptAllowUpward: Map<string, boolean>;
  bridgesFrom: Map<string, { to: string; depth: 'head_senior' | 'whole_dept' }[]>;
  excByUser: Map<string, VisException>;
  excByRole: Map<string, VisException>;
  excByDept: Map<string, VisException>;
}

interface OrgConfig {
  masterOverride: boolean;
  fullVisRoles: string[];
  fullVisUsers: string[];
  excludeDepts: string[];
  excludeRoles: string[];
  configRoles: string[];
}

export interface ResolveTrace {
  reason:
    | 'master_override'
    | 'full_visibility'
    | 'exception_narrow'
    | 'exception_widen'
    | 'base_default';
  exception_id?: string;
  exception_scope?: string;
  bridges_used?: { to_department_id: string; depth: string; match_count: number }[];
  excluded_count?: number;
}

/**
 * Resolves the assignee picker pool for a user, following the deterministic pipeline:
 *   1 master override → all (bypasses excludes)
 *   2 full-visibility list (users+roles) → all (bypasses excludes)
 *   3 governing exception, most-specific wins (user > role > department):
 *       narrow → shortlist + self (excludes do NOT apply); widen → all (excludes apply)
 *       none   → base default = own dept (±upward switch) + subordinates + self
 *   4 cross-dept bridges from the user's dept (base default only)
 *   5 excludes (sensitive groups) — not for steps 1/2 or a narrow shortlist
 *   6 self always included
 *
 * @Global so employees/departments/roles services can call invalidate() without circular deps.
 */
@Injectable()
export class AssigneeVisibilityService {
  private readonly graphCache = new Map<string, { value: OrgGraph; expires: number }>();
  private readonly configCache = new Map<string, { value: OrgConfig; expires: number }>();

  constructor(private readonly prisma: PrismaService) {}

  invalidate(orgId: string) {
    this.graphCache.delete(orgId);
    this.configCache.delete(orgId);
  }

  // ─── Public resolution ────────────────────────────────────────────────────────

  async resolve(orgId: string, userId: string): Promise<{ pool: Set<string>; trace: ResolveTrace }> {
    const [cfg, g] = await Promise.all([this.getConfig(orgId), this.getGraph(orgId)]);
    const all = new Set(g.activeUserIds);

    // 1 — master override
    if (cfg.masterOverride) {
      all.add(userId);
      return { pool: all, trace: { reason: 'master_override' } };
    }

    // 2 — full-visibility list (bypasses excludes)
    const memberRole = g.memberRoleOf.get(userId) ?? null;
    if ((memberRole && cfg.fullVisRoles.includes(memberRole)) || cfg.fullVisUsers.includes(userId)) {
      all.add(userId);
      return { pool: all, trace: { reason: 'full_visibility' } };
    }

    // 3 — governing exception (most specific wins)
    const deptId = g.deptOf.get(userId) ?? null;
    const exc =
      g.excByUser.get(userId) ??
      (memberRole ? g.excByRole.get(memberRole) : undefined) ??
      (deptId ? g.excByDept.get(deptId) : undefined);

    if (exc?.kind === 'narrow') {
      const pool = new Set<string>();
      for (const id of exc.shortlist) if (all.has(id)) pool.add(id);
      pool.add(userId);
      return {
        pool,
        trace: { reason: 'exception_narrow', exception_id: exc.id, exception_scope: exc.scope },
      };
    }

    let base: Set<string>;
    const trace: ResolveTrace = { reason: 'base_default' };
    if (exc?.kind === 'widen') {
      base = new Set(all);
      trace.reason = 'exception_widen';
      trace.exception_id = exc.id;
      trace.exception_scope = exc.scope;
    } else {
      base = this.computeBaseDefault(g, userId, deptId);
      // 4 — cross-department bridges from this user's department
      const bridgesUsed: { to_department_id: string; depth: string; match_count: number }[] = [];
      if (deptId) {
        for (const b of g.bridgesFrom.get(deptId) ?? []) {
          const slice = b.depth === 'whole_dept' ? g.deptMembers.get(b.to) : g.deptSeniors.get(b.to);
          const ids = slice ? [...slice] : [];
          ids.forEach((id) => base.add(id));
          bridgesUsed.push({ to_department_id: b.to, depth: b.depth, match_count: ids.length });
        }
      }
      if (bridgesUsed.length) trace.bridges_used = bridgesUsed;
    }

    // 5 — excludes (sensitive groups); self is re-added in step 6 so it always survives
    const excludeDepts = new Set(cfg.excludeDepts);
    const excludeRoles = new Set(cfg.excludeRoles);
    const pool = new Set<string>();
    let excludedCount = 0;
    for (const id of base) {
      if (id === userId) continue; // handled by step 6
      const dOf = g.deptOf.get(id);
      const rOf = g.memberRoleOf.get(id);
      if ((dOf && excludeDepts.has(dOf)) || (rOf && excludeRoles.has(rOf))) {
        excludedCount++;
        continue;
      }
      pool.add(id);
    }
    pool.add(userId); // 6 — self always
    if (excludedCount) trace.excluded_count = excludedCount;
    return { pool, trace };
  }

  /** Profile data for the org (active employees) — used to render picker items / explain. */
  async getProfiles(orgId: string): Promise<Map<string, ProfileLite>> {
    return (await this.getGraph(orgId)).profiles;
  }

  /** All user IDs reporting (directly or transitively) to `userId`. Used by Work Log. */
  async getSubordinateUserIds(orgId: string, userId: string): Promise<string[]> {
    const g = await this.getGraph(orgId);
    return [...this.getSubordinates(g, userId)];
  }

  /** Whether `candidateId` sits below `managerId` in the reporting hierarchy. */
  async isSubordinate(orgId: string, managerId: string, candidateId: string): Promise<boolean> {
    const g = await this.getGraph(orgId);
    return this.getSubordinates(g, managerId).has(candidateId);
  }

  /** How many people a bridge of the given depth would currently expose in the target dept. */
  async countBridgeTargets(
    orgId: string,
    toDeptId: string,
    depth: 'head_senior' | 'whole_dept',
  ): Promise<number> {
    const g = await this.getGraph(orgId);
    const slice = depth === 'whole_dept' ? g.deptMembers.get(toDeptId) : g.deptSeniors.get(toDeptId);
    return slice ? slice.size : 0;
  }

  /** Full explanation for "why can X assign to Y" debugging. */
  async explain(orgId: string, userId: string) {
    const { pool, trace } = await this.resolve(orgId, userId);
    const g = await this.getGraph(orgId);
    const users = [...pool]
      .map((id) => g.profiles.get(id))
      .filter((p): p is ProfileLite => !!p)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { user_id: userId, trace, total: pool.size, users };
  }

  // ─── Base default (Hierarchy + Department, ± upward switch) ──────────────────────

  private computeBaseDefault(g: OrgGraph, userId: string, deptId: string | null): Set<string> {
    const s = new Set<string>([userId]);
    for (const sub of this.getSubordinates(g, userId)) s.add(sub);

    if (deptId) {
      const members = g.deptMembers.get(deptId) ?? new Set<string>();
      const allowUpward = g.deptAllowUpward.get(deptId) ?? true;
      if (allowUpward) {
        members.forEach((id) => s.add(id));
      } else {
        // Keep the direct manager; drop ancestors strictly above the manager.
        const directManager = g.directManagerOf.get(userId) ?? null;
        const ancestors = this.getAncestors(g, userId);
        members.forEach((id) => {
          if (ancestors.has(id) && id !== directManager) return;
          s.add(id);
        });
      }
    }
    return s;
  }

  private getSubordinates(g: OrgGraph, userId: string): Set<string> {
    const out = new Set<string>();
    const visit = (uid: string) => {
      for (const child of g.childrenOf.get(uid) ?? []) {
        if (out.has(child)) continue;
        out.add(child);
        visit(child);
      }
    };
    visit(userId);
    return out;
  }

  private getAncestors(g: OrgGraph, userId: string): Set<string> {
    const out = new Set<string>();
    let cur = g.directManagerOf.get(userId) ?? null;
    while (cur && !out.has(cur)) {
      out.add(cur);
      cur = g.directManagerOf.get(cur) ?? null;
    }
    return out;
  }

  // ─── Cached config + graph ──────────────────────────────────────────────────────

  private async getConfig(orgId: string): Promise<OrgConfig> {
    const cached = this.configCache.get(orgId);
    if (cached && cached.expires > Date.now()) return cached.value;

    const tm = await this.prisma.taskMaster.findUnique({ where: { organization_id: orgId } });
    const asArr = (v: unknown, fallback: string[]): string[] =>
      Array.isArray(v) ? (v as string[]) : fallback;
    const value: OrgConfig = {
      masterOverride: tm?.assignee_master_override ?? false,
      fullVisRoles: asArr(tm?.assignee_full_visibility_roles, DEFAULT_FULL_VISIBILITY_ROLES),
      fullVisUsers: asArr(tm?.assignee_full_visibility_users, []),
      excludeDepts: asArr(tm?.assignee_exclude_departments, []),
      excludeRoles: asArr(tm?.assignee_exclude_roles, []),
      configRoles: asArr(tm?.assignee_visibility_config_roles, DEFAULT_FULL_VISIBILITY_ROLES),
    };
    this.configCache.set(orgId, { value, expires: Date.now() + CONFIG_TTL_MS });
    return value;
  }

  /** Roles permitted to edit visibility settings (used by the controller for auth). */
  async getConfigRoles(orgId: string): Promise<string[]> {
    return (await this.getConfig(orgId)).configRoles;
  }

  private async getGraph(orgId: string): Promise<OrgGraph> {
    const cached = this.graphCache.get(orgId);
    if (cached && cached.expires > Date.now()) return cached.value;

    const [profiles, departments, members, bridges, exceptions] = await Promise.all([
      this.prisma.employeeProfile.findMany({
        where: { organization_id: orgId, status: 'active' },
        include: {
          user: { select: { id: true, name: true, is_active: true } },
          department: { select: { id: true, name: true } },
          role: { select: { title: true, level: true } },
        },
      }),
      this.prisma.department.findMany({
        where: { organization_id: orgId },
        select: { id: true, head_user_id: true, assignee_allow_upward: true },
      }),
      this.prisma.organizationMember.findMany({
        where: { organization_id: orgId, is_active: true },
        select: { user_id: true, role: true },
      }),
      this.prisma.assigneeCrossDeptBridge.findMany({ where: { organization_id: orgId } }),
      this.prisma.assigneeVisibilityException.findMany({
        where: { organization_id: orgId },
        include: { members: { select: { user_id: true } } },
      }),
    ]);

    const memberRoleOf = new Map<string, string>(members.map((m) => [m.user_id, m.role]));
    const profileMap = new Map<string, ProfileLite>();
    const deptOf = new Map<string, string>();
    const directManagerOf = new Map<string, string | null>();
    const childrenOf = new Map<string, string[]>();
    const deptMembers = new Map<string, Set<string>>();
    const deptSeniors = new Map<string, Set<string>>();
    const activeUserIds: string[] = [];

    for (const p of profiles) {
      if (!p.user.is_active) continue;
      activeUserIds.push(p.user_id);
      profileMap.set(p.user_id, {
        user_id: p.user_id,
        name: p.user.name,
        department_id: p.department_id,
        department_name: p.department.name,
        role_title: p.role.title,
        role_level: p.role.level,
        member_role: memberRoleOf.get(p.user_id) ?? null,
        reporting_to_user_id: p.reporting_to_user_id ?? null,
      });
      deptOf.set(p.user_id, p.department_id);
      directManagerOf.set(p.user_id, p.reporting_to_user_id ?? null);
      if (p.reporting_to_user_id) {
        const arr = childrenOf.get(p.reporting_to_user_id) ?? [];
        arr.push(p.user_id);
        childrenOf.set(p.reporting_to_user_id, arr);
      }
      if (!deptMembers.has(p.department_id)) deptMembers.set(p.department_id, new Set());
      deptMembers.get(p.department_id)!.add(p.user_id);
      if (SENIOR_LEVELS.has(p.role.level)) {
        if (!deptSeniors.has(p.department_id)) deptSeniors.set(p.department_id, new Set());
        deptSeniors.get(p.department_id)!.add(p.user_id);
      }
    }

    const deptAllowUpward = new Map<string, boolean>();
    for (const d of departments) {
      deptAllowUpward.set(d.id, d.assignee_allow_upward);
      // The configured head counts toward the "head + senior" bridge slice (if active).
      if (d.head_user_id && profileMap.has(d.head_user_id)) {
        if (!deptSeniors.has(d.id)) deptSeniors.set(d.id, new Set());
        deptSeniors.get(d.id)!.add(d.head_user_id);
      }
    }

    const bridgesFrom = new Map<string, { to: string; depth: 'head_senior' | 'whole_dept' }[]>();
    for (const b of bridges) {
      const arr = bridgesFrom.get(b.from_department_id) ?? [];
      arr.push({ to: b.to_department_id, depth: b.depth as 'head_senior' | 'whole_dept' });
      bridgesFrom.set(b.from_department_id, arr);
    }

    const excByUser = new Map<string, VisException>();
    const excByRole = new Map<string, VisException>();
    const excByDept = new Map<string, VisException>();
    for (const e of exceptions) {
      const v: VisException = {
        id: e.id,
        scope: e.scope as VisException['scope'],
        kind: e.kind as VisException['kind'],
        shortlist: new Set(e.members.map((m) => m.user_id)),
      };
      if (e.scope === 'user' && e.scope_user_id) excByUser.set(e.scope_user_id, v);
      else if (e.scope === 'role' && e.scope_role) excByRole.set(e.scope_role, v);
      else if (e.scope === 'department' && e.scope_department_id) excByDept.set(e.scope_department_id, v);
    }

    const value: OrgGraph = {
      activeUserIds,
      profiles: profileMap,
      deptOf,
      memberRoleOf,
      directManagerOf,
      childrenOf,
      deptMembers,
      deptSeniors,
      deptAllowUpward,
      bridgesFrom,
      excByUser,
      excByRole,
      excByDept,
    };
    this.graphCache.set(orgId, { value, expires: Date.now() + GRAPH_TTL_MS });
    return value;
  }

  // ─── Admin: edit config / exceptions / bridges / upward switch ───────────────────

  /** Throws unless the actor's member role is in the org's config_roles list. */
  async assertCanEdit(orgId: string, userId: string): Promise<void> {
    const roles = await this.getConfigRoles(orgId);
    const member = await this.prisma.organizationMember.findUnique({
      where: { organization_id_user_id: { organization_id: orgId, user_id: userId } },
      select: { role: true },
    });
    if (!member || !roles.includes(member.role)) {
      throw new ForbiddenException(
        'You do not have permission to edit assignee visibility settings',
      );
    }
  }

  private async ensureMaster(orgId: string) {
    return this.prisma.taskMaster.upsert({
      where: { organization_id: orgId },
      create: { organization_id: orgId },
      update: {},
    });
  }

  private async audit(
    orgId: string,
    actorUserId: string,
    action: string,
    data: { target?: unknown; before?: unknown; after?: unknown },
  ): Promise<void> {
    await this.prisma.assigneeVisibilityAuditLog
      .create({
        data: {
          organization_id: orgId,
          actor_user_id: actorUserId,
          action,
          target: (data.target ?? null) as never,
          before: (data.before ?? null) as never,
          after: (data.after ?? null) as never,
        },
      })
      .catch(() => null);
  }

  /** Full admin view for the masters UI. */
  async getAdminView(orgId: string) {
    const tm = await this.ensureMaster(orgId);
    const [exceptions, bridges, departments, g] = await Promise.all([
      this.prisma.assigneeVisibilityException.findMany({
        where: { organization_id: orgId },
        include: { members: { select: { user_id: true } } },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.assigneeCrossDeptBridge.findMany({
        where: { organization_id: orgId },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.department.findMany({
        where: { organization_id: orgId },
        select: { id: true, name: true, assignee_allow_upward: true },
        orderBy: { name: 'asc' },
      }),
      this.getGraph(orgId),
    ]);
    const nameOf = (id: string) => g.profiles.get(id)?.name ?? null;
    const deptName = new Map(departments.map((d) => [d.id, d.name]));
    const sliceSize = (toId: string, depth: string) =>
      (depth === 'whole_dept' ? g.deptMembers.get(toId) : g.deptSeniors.get(toId))?.size ?? 0;

    return {
      settings: {
        master_override: tm.assignee_master_override,
        exclude_departments: tm.assignee_exclude_departments,
        exclude_roles: tm.assignee_exclude_roles,
        full_visibility_roles: tm.assignee_full_visibility_roles,
        full_visibility_users: tm.assignee_full_visibility_users,
        config_roles: tm.assignee_visibility_config_roles,
      },
      exceptions: exceptions.map((e) => ({
        id: e.id,
        scope: e.scope,
        kind: e.kind,
        scope_user_id: e.scope_user_id,
        scope_user_name: e.scope_user_id ? nameOf(e.scope_user_id) : null,
        scope_role: e.scope_role,
        scope_department_id: e.scope_department_id,
        scope_department_name: e.scope_department_id
          ? deptName.get(e.scope_department_id) ?? null
          : null,
        members: e.members.map((m) => ({ user_id: m.user_id, name: nameOf(m.user_id) })),
      })),
      bridges: bridges.map((b) => ({
        id: b.id,
        from_department_id: b.from_department_id,
        from_department_name: deptName.get(b.from_department_id) ?? null,
        to_department_id: b.to_department_id,
        to_department_name: deptName.get(b.to_department_id) ?? null,
        depth: b.depth,
        match_count: sliceSize(b.to_department_id, b.depth),
      })),
      departments,
    };
  }

  async updateSettings(orgId: string, actorUserId: string, dto: UpdateAssigneeSettingsDto) {
    await this.assertCanEdit(orgId, actorUserId);
    const before = await this.ensureMaster(orgId);
    const data: Record<string, unknown> = {};
    if (dto.master_override !== undefined) data.assignee_master_override = dto.master_override;
    if (dto.exclude_departments !== undefined)
      data.assignee_exclude_departments = dto.exclude_departments;
    if (dto.exclude_roles !== undefined) data.assignee_exclude_roles = dto.exclude_roles;
    if (dto.full_visibility_roles !== undefined)
      data.assignee_full_visibility_roles = dto.full_visibility_roles;
    if (dto.full_visibility_users !== undefined)
      data.assignee_full_visibility_users = dto.full_visibility_users;
    if (dto.config_roles !== undefined) {
      if (!Array.isArray(dto.config_roles) || dto.config_roles.length === 0) {
        throw new BadRequestException('At least one role must be able to edit these settings');
      }
      data.assignee_visibility_config_roles = dto.config_roles;
    }
    const updated = await this.prisma.taskMaster.update({
      where: { organization_id: orgId },
      data: data as never,
    });
    this.invalidate(orgId);
    const subset = (m: typeof updated) => ({
      master_override: m.assignee_master_override,
      exclude_departments: m.assignee_exclude_departments,
      exclude_roles: m.assignee_exclude_roles,
      full_visibility_roles: m.assignee_full_visibility_roles,
      full_visibility_users: m.assignee_full_visibility_users,
      config_roles: m.assignee_visibility_config_roles,
    });
    await this.audit(orgId, actorUserId, 'settings_updated', {
      before: subset(before),
      after: subset(updated),
    });
    return subset(updated);
  }

  async createException(orgId: string, actorUserId: string, dto: CreateExceptionDto) {
    await this.assertCanEdit(orgId, actorUserId);
    if (dto.scope === 'user' && !dto.scope_user_id)
      throw new BadRequestException('scope_user_id is required for a user-scoped exception');
    if (dto.scope === 'role' && !dto.scope_role)
      throw new BadRequestException('scope_role is required for a role-scoped exception');
    if (dto.scope === 'department' && !dto.scope_department_id)
      throw new BadRequestException('scope_department_id is required for a department-scoped exception');
    const members = dto.kind === 'narrow' ? [...new Set(dto.member_user_ids ?? [])] : [];
    const created = await this.prisma.assigneeVisibilityException.create({
      data: {
        organization_id: orgId,
        scope: dto.scope,
        kind: dto.kind,
        scope_user_id: dto.scope === 'user' ? dto.scope_user_id : null,
        scope_role: dto.scope === 'role' ? dto.scope_role : null,
        scope_department_id: dto.scope === 'department' ? dto.scope_department_id : null,
        created_by: actorUserId,
        members: { create: members.map((uid) => ({ user_id: uid })) },
      },
      include: { members: { select: { user_id: true } } },
    });
    this.invalidate(orgId);
    await this.audit(orgId, actorUserId, 'exception_created', {
      target: { id: created.id },
      after: dto as unknown,
    });
    return created;
  }

  async deleteException(orgId: string, actorUserId: string, id: string) {
    await this.assertCanEdit(orgId, actorUserId);
    const exc = await this.prisma.assigneeVisibilityException.findFirst({
      where: { id, organization_id: orgId },
    });
    if (!exc) throw new NotFoundException('Exception not found');
    await this.prisma.assigneeVisibilityException.delete({ where: { id } }); // members cascade
    this.invalidate(orgId);
    await this.audit(orgId, actorUserId, 'exception_deleted', { target: { id }, before: exc as unknown });
    return { ok: true };
  }

  async createBridge(orgId: string, actorUserId: string, dto: CreateBridgeDto) {
    await this.assertCanEdit(orgId, actorUserId);
    if (dto.from_department_id === dto.to_department_id)
      throw new BadRequestException('A bridge must connect two different departments');
    const depts = await this.prisma.department.findMany({
      where: { organization_id: orgId, id: { in: [dto.from_department_id, dto.to_department_id] } },
      select: { id: true },
    });
    if (depts.length !== 2)
      throw new BadRequestException('Both departments must exist in this organization');
    const exists = await this.prisma.assigneeCrossDeptBridge.findFirst({
      where: {
        organization_id: orgId,
        from_department_id: dto.from_department_id,
        to_department_id: dto.to_department_id,
      },
    });
    if (exists) throw new BadRequestException('A bridge for this direction already exists');
    const created = await this.prisma.assigneeCrossDeptBridge.create({
      data: {
        organization_id: orgId,
        from_department_id: dto.from_department_id,
        to_department_id: dto.to_department_id,
        depth: dto.depth,
        created_by: actorUserId,
      },
    });
    this.invalidate(orgId);
    await this.audit(orgId, actorUserId, 'bridge_created', {
      target: { id: created.id },
      after: dto as unknown,
    });
    return created;
  }

  async deleteBridge(orgId: string, actorUserId: string, id: string) {
    await this.assertCanEdit(orgId, actorUserId);
    const bridge = await this.prisma.assigneeCrossDeptBridge.findFirst({
      where: { id, organization_id: orgId },
    });
    if (!bridge) throw new NotFoundException('Bridge not found');
    await this.prisma.assigneeCrossDeptBridge.delete({ where: { id } });
    this.invalidate(orgId);
    await this.audit(orgId, actorUserId, 'bridge_deleted', { target: { id }, before: bridge as unknown });
    return { ok: true };
  }

  async setDepartmentUpward(orgId: string, actorUserId: string, dto: SetDeptUpwardDto) {
    await this.assertCanEdit(orgId, actorUserId);
    const dept = await this.prisma.department.findFirst({
      where: { id: dto.department_id, organization_id: orgId },
    });
    if (!dept) throw new NotFoundException('Department not found');
    const updated = await this.prisma.department.update({
      where: { id: dto.department_id },
      data: { assignee_allow_upward: dto.allow },
    });
    this.invalidate(orgId);
    await this.audit(orgId, actorUserId, 'upward_switch_changed', {
      target: { department_id: dto.department_id },
      before: { allow: dept.assignee_allow_upward },
      after: { allow: dto.allow },
    });
    return { id: updated.id, assignee_allow_upward: updated.assignee_allow_upward };
  }
}
