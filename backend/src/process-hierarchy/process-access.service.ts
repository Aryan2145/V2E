import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProcessAccessKind, ProcessAccessLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Principal } from '../access-rights/permissions.service';

/**
 * Row-level access engine for the Process Hierarchy module.
 *
 * Visibility here is ATTACHMENT-based, not the standard participant/data-scope model
 * (the leaf is registered `self_scoped`). The universal rule:
 *
 *   Everything cascades DOWN to sub-nodes by default; anything can be RESTRICTED at
 *   a lower node.
 *
 * Resolution for a node = the node itself + all its ancestors. We gather every
 * ProcessNodeAccess rule on that chain, then evaluate for the acting user:
 *   - Admins and the map OWNER (created_by_user_id) always view + edit (bootstrap).
 *   - `exclude_user` anywhere in the chain hides the node from that person ("attached
 *     but hidden") — unless they are admin/owner.
 *   - Otherwise VIEW is granted by any matching department/role/user rule (view OR
 *     edit level); EDIT is granted only by an `edit`-level matching rule.
 *   - A department rule matches the user's own department, and its descendants when
 *     `include_sub_departments` is set (cascade).
 *
 * Viewers never reach edit routes — the controller's `@RequirePermission(..., edit)`
 * blocks them before this service is consulted — so an edit-level attachment can only
 * ever empower a Contributor, never a Viewer.
 */
@Injectable()
export class ProcessAccessService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── User context (cached per call site is unnecessary; maps are small) ────────

  private async actorContext(orgId: string, userId: string) {
    const profile = await this.prisma.employeeProfile.findFirst({
      where: { organization_id: orgId, user_id: userId },
      select: { department_id: true, role_id: true },
    });
    const deptChain = profile?.department_id
      ? await this.departmentChain(orgId, profile.department_id)
      : new Set<string>();
    return {
      userId,
      departmentId: profile?.department_id ?? null,
      roleId: profile?.role_id ?? null,
      deptChain, // the user's dept + all ancestor depts (for subtree matching)
    };
  }

  /** The user's department plus every ancestor department id (self → root). */
  private async departmentChain(orgId: string, departmentId: string): Promise<Set<string>> {
    const depts = await this.prisma.department.findMany({
      where: { organization_id: orgId },
      select: { id: true, parent_department_id: true },
    });
    const parentOf = new Map(depts.map((d) => [d.id, d.parent_department_id]));
    const chain = new Set<string>();
    let cur: string | null | undefined = departmentId;
    while (cur && !chain.has(cur)) {
      chain.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
    return chain;
  }

  // ─── Node chain (node + ancestors) within a map ────────────────────────────────

  /** Load the ancestor chain [node, parent, …root] for a node, scoped to org. */
  private async nodeChain(orgId: string, nodeId: string) {
    const nodes = await this.prisma.processNode.findMany({
      where: { organization_id: orgId, is_deleted: false },
      select: { id: true, map_id: true, parent_node_id: true, created_by_user_id: true },
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const start = byId.get(nodeId);
    if (!start) return null;
    const chain: string[] = [];
    let cur: string | null | undefined = nodeId;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      chain.push(cur);
      cur = byId.get(cur)?.parent_node_id ?? null;
    }
    return { mapId: start.map_id, chain };
  }

  // ─── Rule matching ─────────────────────────────────────────────────────────────

  private ruleMatchesUser(
    rule: {
      kind: ProcessAccessKind;
      department_id: string | null;
      include_sub_departments: boolean;
      role_id: string | null;
      user_id: string | null;
    },
    ctx: { userId: string; roleId: string | null; departmentId: string | null; deptChain: Set<string> },
  ): boolean {
    switch (rule.kind) {
      case ProcessAccessKind.user:
      case ProcessAccessKind.exclude_user:
        return rule.user_id === ctx.userId;
      case ProcessAccessKind.role:
        return !!ctx.roleId && rule.role_id === ctx.roleId;
      case ProcessAccessKind.department:
        if (!rule.department_id) return false;
        if (rule.department_id === ctx.departmentId) return true;
        return rule.include_sub_departments && ctx.deptChain.has(rule.department_id);
      default:
        return false;
    }
  }

  // ─── Core resolution: does the user get view / edit on this node? ───────────────

  private async resolveNode(
    orgId: string,
    principal: Principal,
    nodeId: string,
  ): Promise<{ mapId: string; canView: boolean; canEdit: boolean } | null> {
    const chainInfo = await this.nodeChain(orgId, nodeId);
    if (!chainInfo) return null;
    const { mapId, chain } = chainInfo;

    const map = await this.prisma.processMap.findFirst({
      where: { id: mapId, organization_id: orgId, is_deleted: false },
      select: { created_by_user_id: true },
    });
    if (!map) return null;

    // Owner + admin bootstrap: full control, immune to exclude rules.
    if (principal.isAdmin || map.created_by_user_id === principal.userId) {
      return { mapId, canView: true, canEdit: true };
    }

    const rules = await this.prisma.processNodeAccess.findMany({
      where: { organization_id: orgId, node_id: { in: chain } },
    });
    const ctx = await this.actorContext(orgId, principal.userId);

    let excluded = false;
    let view = false;
    let edit = false;
    for (const rule of rules) {
      if (!this.ruleMatchesUser(rule, ctx)) continue;
      if (rule.kind === ProcessAccessKind.exclude_user) {
        excluded = true;
        continue;
      }
      view = true;
      if (rule.level === ProcessAccessLevel.edit) edit = true;
    }
    if (excluded) return { mapId, canView: false, canEdit: false };
    return { mapId, canView: view, canEdit: edit };
  }

  // ─── Public gates (fail closed, no data leaked) ────────────────────────────────

  async assertCanViewNode(orgId: string, principal: Principal, nodeId: string): Promise<void> {
    const r = await this.resolveNode(orgId, principal, nodeId);
    if (!r) throw new NotFoundException('Process node not found');
    if (!r.canView) throw new NotFoundException('Process node not found');
  }

  async assertCanEditNode(orgId: string, principal: Principal, nodeId: string): Promise<void> {
    const r = await this.resolveNode(orgId, principal, nodeId);
    if (!r) throw new NotFoundException('Process node not found');
    if (!r.canView) throw new NotFoundException('Process node not found');
    if (!r.canEdit) throw new ForbiddenException('You do not have edit access to this part of the process');
  }

  async canEditNode(orgId: string, principal: Principal, nodeId: string): Promise<boolean> {
    const r = await this.resolveNode(orgId, principal, nodeId);
    return !!r?.canEdit;
  }

  // ─── Map-level gates ───────────────────────────────────────────────────────────

  private async mapOwnerId(orgId: string, mapId: string): Promise<string | null> {
    const map = await this.prisma.processMap.findFirst({
      where: { id: mapId, organization_id: orgId, is_deleted: false },
      select: { created_by_user_id: true },
    });
    return map ? map.created_by_user_id : null;
  }

  /** Can the user view the map at all? Owner/admin, or has ANY (non-excluded) access rule inside it. */
  async canViewMap(orgId: string, principal: Principal, mapId: string): Promise<boolean> {
    if (principal.isAdmin) return true;
    const owner = await this.mapOwnerId(orgId, mapId);
    if (owner === null) return false;
    if (owner === principal.userId) return true;

    const rules = await this.prisma.processNodeAccess.findMany({
      where: { organization_id: orgId, node: { map_id: mapId, is_deleted: false } },
    });
    if (rules.length === 0) return false;
    const ctx = await this.actorContext(orgId, principal.userId);
    const excludedFor = new Set<string>();
    const grantedFor = new Set<string>();
    for (const rule of rules) {
      if (!this.ruleMatchesUser(rule, ctx)) continue;
      if (rule.kind === ProcessAccessKind.exclude_user) excludedFor.add(rule.node_id);
      else grantedFor.add(rule.node_id);
    }
    // Visible if at least one node grants access to this user and isn't excluded on that same node.
    return [...grantedFor].some((nodeId) => !excludedFor.has(nodeId));
  }

  async assertCanViewMap(orgId: string, principal: Principal, mapId: string): Promise<void> {
    if (!(await this.canViewMap(orgId, principal, mapId))) {
      throw new NotFoundException('Process map not found');
    }
  }

  /** Map-level edit (rename, snapshot, add top-level nodes) — owner/admin only. */
  async canEditMap(orgId: string, principal: Principal, mapId: string): Promise<boolean> {
    if (principal.isAdmin) return true;
    const owner = await this.mapOwnerId(orgId, mapId);
    return owner !== null && owner === principal.userId;
  }

  async assertCanEditMap(orgId: string, principal: Principal, mapId: string): Promise<void> {
    const owner = await this.mapOwnerId(orgId, mapId);
    if (owner === null) throw new NotFoundException('Process map not found');
    if (!principal.isAdmin && owner !== principal.userId) {
      throw new ForbiddenException('Only the map owner or an administrator can change this');
    }
  }

  /**
   * Which of these maps can the user see? Batched for the map list.
   * Returns the set of visible map ids.
   */
  async visibleMapIds(
    orgId: string,
    principal: Principal,
    maps: { id: string; created_by_user_id: string }[],
  ): Promise<Set<string>> {
    if (principal.isAdmin) return new Set(maps.map((m) => m.id));
    const visible = new Set<string>();
    const shared: string[] = [];
    for (const m of maps) {
      if (m.created_by_user_id === principal.userId) visible.add(m.id);
      else shared.push(m.id);
    }
    if (shared.length === 0) return visible;

    const rules = await this.prisma.processNodeAccess.findMany({
      where: { organization_id: orgId, node: { map_id: { in: shared }, is_deleted: false } },
      select: {
        node_id: true,
        node: { select: { map_id: true } },
        kind: true,
        department_id: true,
        include_sub_departments: true,
        role_id: true,
        user_id: true,
      },
    });
    const ctx = await this.actorContext(orgId, principal.userId);
    const grantByMap = new Map<string, Set<string>>(); // map_id -> node_ids granting
    const excludeByMap = new Map<string, Set<string>>(); // map_id -> node_ids excluding
    for (const rule of rules) {
      if (!this.ruleMatchesUser(rule, ctx)) continue;
      const mapId = rule.node.map_id;
      if (rule.kind === ProcessAccessKind.exclude_user) {
        (excludeByMap.get(mapId) ?? excludeByMap.set(mapId, new Set()).get(mapId)!).add(rule.node_id);
      } else {
        (grantByMap.get(mapId) ?? grantByMap.set(mapId, new Set()).get(mapId)!).add(rule.node_id);
      }
    }
    for (const [mapId, granted] of grantByMap) {
      const excluded = excludeByMap.get(mapId) ?? new Set<string>();
      if ([...granted].some((n) => !excluded.has(n))) visible.add(mapId);
    }
    return visible;
  }
}
