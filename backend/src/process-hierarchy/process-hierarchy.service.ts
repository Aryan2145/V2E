import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProcessAccessKind, ProcessAccessLevel, ProcessNodeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Principal } from '../access-rights/permissions.service';
import { ProcessAccessService } from './process-access.service';
import { computeMapDiff, type MapDiff } from './process-diff';
import {
  UploadedFile,
  validateAttachmentFile,
  extensionOf,
} from '../tasks/task-attachments.service';
import { CreateMapDto, UpdateMapDto } from './dto/map.dto';
import { BulkPositionDto, CreateNodeDto, UpdateNodeDto } from './dto/node.dto';
import { CreateConnectionDto, UpdateConnectionDto } from './dto/connection.dto';
import { CreateArtifactDto, LinkArtifactDto, UpdateArtifactDto } from './dto/artifact.dto';
import { AddAccessRuleDto } from './dto/access.dto';
import { CreateSnapshotDto } from './dto/snapshot.dto';

@Injectable()
export class ProcessHierarchyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProcessAccessService,
    private readonly r2: R2Service,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Maps ──────────────────────────────────────────────────────────────────────

  async listMaps(orgId: string, principal: Principal) {
    const maps = await this.prisma.processMap.findMany({
      where: { organization_id: orgId, is_deleted: false },
      orderBy: { updated_at: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        created_by_user_id: true,
        created_at: true,
        updated_at: true,
        _count: { select: { nodes: true } },
      },
    });
    const visible = await this.access.visibleMapIds(orgId, principal, maps);
    return maps
      .filter((m) => visible.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        node_count: m._count.nodes,
        is_owner: m.created_by_user_id === principal.userId,
        can_edit: principal.isAdmin || m.created_by_user_id === principal.userId,
        created_at: m.created_at,
        updated_at: m.updated_at,
      }));
  }

  async createMap(orgId: string, userId: string, dto: CreateMapDto) {
    return this.prisma.processMap.create({
      data: {
        organization_id: orgId,
        name: dto.name.trim(),
        description: dto.description ?? null,
        created_by_user_id: userId,
      },
    });
  }

  async getMap(orgId: string, principal: Principal, mapId: string) {
    await this.access.assertCanViewMap(orgId, principal, mapId);
    const map = await this.prisma.processMap.findFirst({
      where: { id: mapId, organization_id: orgId, is_deleted: false },
      select: {
        id: true,
        name: true,
        description: true,
        created_by_user_id: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!map) throw new NotFoundException('Process map not found');
    return {
      ...map,
      is_owner: map.created_by_user_id === principal.userId,
      can_edit: await this.access.canEditMap(orgId, principal, mapId),
    };
  }

  async updateMap(orgId: string, principal: Principal, mapId: string, dto: UpdateMapDto) {
    await this.access.assertCanEditMap(orgId, principal, mapId);
    return this.prisma.processMap.update({
      where: { id: mapId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
  }

  async deleteMap(orgId: string, principal: Principal, mapId: string) {
    // Route already gates the `delete` action (admin). Confirm existence in-org.
    const map = await this.prisma.processMap.findFirst({
      where: { id: mapId, organization_id: orgId, is_deleted: false },
      select: { id: true },
    });
    if (!map) throw new NotFoundException('Process map not found');
    await this.prisma.processMap.update({
      where: { id: mapId },
      data: { is_deleted: true, deleted_at: new Date(), deleted_by_user_id: principal.userId },
    });
    return { success: true };
  }

  // ─── Flow (one drill level at a time) ───────────────────────────────────────────

  async getFlow(orgId: string, principal: Principal, mapId: string, parentNodeId?: string | null) {
    await this.access.assertCanViewMap(orgId, principal, mapId);
    const parent = parentNodeId
      ? await this.requireNode(orgId, mapId, parentNodeId)
      : null;
    if (parent) await this.access.assertCanViewNode(orgId, principal, parentNodeId!);

    const nodes = await this.prisma.processNode.findMany({
      where: {
        organization_id: orgId,
        map_id: mapId,
        is_deleted: false,
        parent_node_id: parentNodeId ?? null,
      },
      orderBy: { sort_order: 'asc' },
    });

    // Hide nodes explicitly excluded from this user (view cascades from the parent,
    // so the only new restriction at this level is an exclude_user on the child).
    let visibleNodes = nodes;
    if (!principal.isAdmin) {
      const owner = await this.prisma.processMap.findFirst({
        where: { id: mapId },
        select: { created_by_user_id: true },
      });
      if (owner?.created_by_user_id !== principal.userId && nodes.length) {
        const excluded = await this.prisma.processNodeAccess.findMany({
          where: {
            organization_id: orgId,
            node_id: { in: nodes.map((n) => n.id) },
            kind: ProcessAccessKind.exclude_user,
            user_id: principal.userId,
          },
          select: { node_id: true },
        });
        const hidden = new Set(excluded.map((e) => e.node_id));
        visibleNodes = nodes.filter((n) => !hidden.has(n.id));
      }
    }

    const nodeIds = visibleNodes.map((n) => n.id);
    const connections = await this.prisma.processConnection.findMany({
      where: {
        organization_id: orgId,
        map_id: mapId,
        parent_node_id: parentNodeId ?? null,
        source_node_id: { in: nodeIds },
        target_node_id: { in: nodeIds },
      },
    });

    // Child counts so the canvas knows which nodes are drillable.
    const childCounts = await this.prisma.processNode.groupBy({
      by: ['parent_node_id'],
      where: { organization_id: orgId, map_id: mapId, is_deleted: false, parent_node_id: { in: nodeIds } },
      _count: { _all: true },
    });
    const childCountBy = new Map(childCounts.map((c) => [c.parent_node_id, c._count._all]));

    const canEdit = parent
      ? await this.access.canEditNode(orgId, principal, parentNodeId!)
      : await this.access.canEditMap(orgId, principal, mapId);

    // Per-node artifact links (id + name) so the canvas can render the document that
    // flows across a connection (output of source ∩ input of target).
    const links = nodeIds.length
      ? await this.prisma.processNodeArtifact.findMany({
          where: { node_id: { in: nodeIds } },
          select: { node_id: true, direction: true, artifact: { select: { id: true, name: true } } },
        })
      : [];
    const linksByNode = new Map<string, { input: { id: string; name: string }[]; output: { id: string; name: string }[] }>();
    for (const l of links) {
      const entry = linksByNode.get(l.node_id) ?? { input: [], output: [] };
      entry[l.direction].push({ id: l.artifact.id, name: l.artifact.name });
      linksByNode.set(l.node_id, entry);
    }

    // Names of cross-linked maps referenced at this level (for the link badge).
    const linkedIds = Array.from(new Set(visibleNodes.map((n) => n.linked_map_id).filter((x): x is string => !!x)));
    const linkedMaps = linkedIds.length
      ? await this.prisma.processMap.findMany({
          where: { id: { in: linkedIds }, organization_id: orgId, is_deleted: false },
          select: { id: true, name: true },
        })
      : [];
    const linkedNameById = new Map(linkedMaps.map((m) => [m.id, m.name]));

    return {
      map_id: mapId,
      parent_node_id: parentNodeId ?? null,
      breadcrumb: await this.breadcrumb(orgId, mapId, parentNodeId ?? null),
      can_edit: canEdit,
      nodes: visibleNodes.map((n) => ({
        ...n,
        child_count: childCountBy.get(n.id) ?? 0,
        linked_map_name: n.linked_map_id ? linkedNameById.get(n.linked_map_id) ?? null : null,
        inputs: linksByNode.get(n.id)?.input ?? [],
        outputs: linksByNode.get(n.id)?.output ?? [],
      })),
      connections,
    };
  }

  /**
   * Flat list of every node in the map — powers the outline tree and search on the
   * client (which builds the hierarchy from parent_node_id). Applies the same
   * exclude-user visibility as getFlow, and additionally hides the descendants of
   * any excluded node so a hidden branch never leaks names through the tree.
   */
  async getTree(orgId: string, principal: Principal, mapId: string) {
    await this.access.assertCanViewMap(orgId, principal, mapId);
    const nodes = await this.prisma.processNode.findMany({
      where: { organization_id: orgId, map_id: mapId, is_deleted: false },
      orderBy: [{ sort_order: 'asc' }],
      select: {
        id: true,
        parent_node_id: true,
        kind: true,
        name: true,
        status: true,
        sort_order: true,
        linked_map_id: true,
      },
    });

    let visible = nodes;
    if (!principal.isAdmin && nodes.length) {
      const owner = await this.prisma.processMap.findFirst({
        where: { id: mapId },
        select: { created_by_user_id: true },
      });
      if (owner?.created_by_user_id !== principal.userId) {
        const excluded = await this.prisma.processNodeAccess.findMany({
          where: {
            organization_id: orgId,
            node_id: { in: nodes.map((n) => n.id) },
            kind: ProcessAccessKind.exclude_user,
            user_id: principal.userId,
          },
          select: { node_id: true },
        });
        if (excluded.length) {
          const childrenBy = new Map<string | null, string[]>();
          for (const n of nodes) {
            const list = childrenBy.get(n.parent_node_id) ?? [];
            list.push(n.id);
            childrenBy.set(n.parent_node_id, list);
          }
          const hidden = new Set<string>();
          const stack = excluded.map((e) => e.node_id);
          while (stack.length) {
            const id = stack.pop()!;
            if (hidden.has(id)) continue;
            hidden.add(id);
            for (const c of childrenBy.get(id) ?? []) stack.push(c);
          }
          visible = nodes.filter((n) => !hidden.has(n.id));
        }
      }
    }

    // Names of cross-linked maps (so the tree can show a link badge).
    const linkedIds = Array.from(
      new Set(visible.map((n) => n.linked_map_id).filter((x): x is string => !!x)),
    );
    const linkedMaps = linkedIds.length
      ? await this.prisma.processMap.findMany({
          where: { id: { in: linkedIds }, organization_id: orgId, is_deleted: false },
          select: { id: true, name: true },
        })
      : [];
    const linkedNameById = new Map(linkedMaps.map((m) => [m.id, m.name]));

    return {
      map_id: mapId,
      can_edit: await this.access.canEditMap(orgId, principal, mapId),
      nodes: visible.map((n) => ({
        ...n,
        linked_map_name: n.linked_map_id ? linkedNameById.get(n.linked_map_id) ?? null : null,
      })),
    };
  }

  private async breadcrumb(orgId: string, mapId: string, parentNodeId: string | null) {
    const crumbs: { id: string | null; name: string }[] = [];
    if (parentNodeId) {
      const all = await this.prisma.processNode.findMany({
        where: { organization_id: orgId, map_id: mapId },
        select: { id: true, name: true, parent_node_id: true },
      });
      const byId = new Map(all.map((n) => [n.id, n]));
      let cur: string | null = parentNodeId;
      const seen = new Set<string>();
      const chain: { id: string; name: string }[] = [];
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        const n = byId.get(cur);
        if (!n) break;
        chain.unshift({ id: n.id, name: n.name });
        cur = n.parent_node_id;
      }
      crumbs.push(...chain);
    }
    return crumbs; // root (the map itself) is rendered by the frontend
  }

  // ─── Nodes ──────────────────────────────────────────────────────────────────────

  private async requireNode(orgId: string, mapId: string, nodeId: string) {
    const node = await this.prisma.processNode.findFirst({
      where: { id: nodeId, map_id: mapId, organization_id: orgId, is_deleted: false },
    });
    if (!node) throw new NotFoundException('Process node not found');
    return node;
  }

  async createNode(orgId: string, principal: Principal, mapId: string, dto: CreateNodeDto) {
    await this.access.assertCanViewMap(orgId, principal, mapId);
    if (dto.parent_node_id) {
      await this.requireNode(orgId, mapId, dto.parent_node_id);
      await this.access.assertCanEditNode(orgId, principal, dto.parent_node_id);
    } else {
      await this.access.assertCanEditMap(orgId, principal, mapId);
    }
    const maxSort = await this.prisma.processNode.aggregate({
      where: { organization_id: orgId, map_id: mapId, parent_node_id: dto.parent_node_id ?? null, is_deleted: false },
      _max: { sort_order: true },
    });
    return this.prisma.processNode.create({
      data: {
        organization_id: orgId,
        map_id: mapId,
        parent_node_id: dto.parent_node_id ?? null,
        kind: dto.kind,
        name: dto.name.trim(),
        description: dto.description ?? null,
        position_x: dto.position_x ?? 0,
        position_y: dto.position_y ?? 0,
        sort_order: (maxSort._max.sort_order ?? -1) + 1,
        created_by_user_id: principal.userId,
      },
    });
  }

  async getNode(orgId: string, principal: Principal, mapId: string, nodeId: string) {
    await this.access.assertCanViewNode(orgId, principal, nodeId);
    const node = await this.requireNode(orgId, mapId, nodeId);
    const [checklist, artifactLinks, accessRules, childCount] = await Promise.all([
      this.prisma.processChecklistItem.findMany({ where: { node_id: nodeId }, orderBy: { sort_order: 'asc' } }),
      this.prisma.processNodeArtifact.findMany({
        where: { node_id: nodeId },
        include: { artifact: true },
      }),
      this.prisma.processNodeAccess.findMany({ where: { organization_id: orgId, node_id: nodeId } }),
      this.prisma.processNode.count({ where: { organization_id: orgId, map_id: mapId, parent_node_id: nodeId, is_deleted: false } }),
    ]);

    const [responsibleUser, responsibleRole] = await Promise.all([
      node.responsible_user_id
        ? this.prisma.user.findUnique({ where: { id: node.responsible_user_id }, select: { id: true, name: true } })
        : Promise.resolve(null),
      node.responsible_role_id
        ? this.prisma.role.findUnique({ where: { id: node.responsible_role_id }, select: { id: true, title: true } })
        : Promise.resolve(null),
    ]);

    const linkedMap = node.linked_map_id
      ? await this.prisma.processMap.findFirst({
          where: { id: node.linked_map_id, organization_id: orgId, is_deleted: false },
          select: { id: true, name: true },
        })
      : null;

    return {
      ...node,
      child_count: childCount,
      can_edit: await this.access.canEditNode(orgId, principal, nodeId),
      can_approve: await this.access.canEditMap(orgId, principal, mapId),
      responsible_user: responsibleUser,
      responsible_role: responsibleRole,
      linked_map: linkedMap,
      checklist,
      inputs: artifactLinks.filter((l) => l.direction === 'input'),
      outputs: artifactLinks.filter((l) => l.direction === 'output'),
      access_rules: await this.enrichAccessRules(orgId, accessRules),
    };
  }

  async updateNode(orgId: string, principal: Principal, mapId: string, nodeId: string, dto: UpdateNodeDto) {
    await this.requireNode(orgId, mapId, nodeId);
    await this.access.assertCanEditNode(orgId, principal, nodeId);

    // Cross-map link: only to a map the actor can see, never to this same map.
    if (dto.linked_map_id) {
      if (dto.linked_map_id === mapId) throw new BadRequestException('A node cannot link to its own map');
      await this.access.assertCanViewMap(orgId, principal, dto.linked_map_id);
    }

    // Re-parent (move to another container/level). Validate same-map, permission on
    // the destination, and no cycle (can't move a node inside itself/its own subtree).
    let reparent: { parent_node_id: string | null; sort_order: number } | null = null;
    if (dto.parent_node_id !== undefined) {
      const newParent = dto.parent_node_id ?? null;
      if (newParent === nodeId) throw new BadRequestException('A node cannot be its own parent');
      const all = await this.prisma.processNode.findMany({
        where: { organization_id: orgId, map_id: mapId, is_deleted: false },
        select: { id: true, parent_node_id: true },
      });
      const byId = new Map(all.map((n) => [n.id, n]));
      if (newParent) {
        if (!byId.has(newParent)) throw new BadRequestException('Target location is not in this map');
        // Walk up from the destination — if we reach this node, the move is a cycle.
        let cur: string | null = newParent;
        const seen = new Set<string>();
        while (cur && !seen.has(cur)) {
          if (cur === nodeId) throw new BadRequestException('Cannot move a node inside itself');
          seen.add(cur);
          cur = byId.get(cur)?.parent_node_id ?? null;
        }
        await this.access.assertCanEditNode(orgId, principal, newParent);
      } else {
        await this.access.assertCanEditMap(orgId, principal, mapId);
      }
      const maxSort = await this.prisma.processNode.aggregate({
        where: { organization_id: orgId, map_id: mapId, parent_node_id: newParent, is_deleted: false },
        _max: { sort_order: true },
      });
      reparent = { parent_node_id: newParent, sort_order: (maxSort._max.sort_order ?? -1) + 1 };
      // Moving levels invalidates this node's connections (edges live at one level).
      await this.prisma.processConnection.deleteMany({
        where: {
          organization_id: orgId,
          map_id: mapId,
          OR: [{ source_node_id: nodeId }, { target_node_id: nodeId }],
        },
      });
    }

    await this.prisma.processNode.update({
      where: { id: nodeId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.responsible_role_id !== undefined ? { responsible_role_id: dto.responsible_role_id } : {}),
        ...(dto.responsible_user_id !== undefined ? { responsible_user_id: dto.responsible_user_id } : {}),
        ...(dto.position_x !== undefined ? { position_x: dto.position_x } : {}),
        ...(dto.position_y !== undefined ? { position_y: dto.position_y } : {}),
        ...(dto.linked_map_id !== undefined ? { linked_map_id: dto.linked_map_id } : {}),
        ...(reparent ? reparent : {}),
      },
    });

    if (dto.checklist !== undefined) {
      await this.replaceChecklist(nodeId, dto.checklist);
    }
    return this.getNode(orgId, principal, mapId, nodeId);
  }

  private async replaceChecklist(nodeId: string, items: { id?: string; text: string }[]) {
    await this.prisma.$transaction([
      this.prisma.processChecklistItem.deleteMany({ where: { node_id: nodeId } }),
      this.prisma.processChecklistItem.createMany({
        data: items.map((it, idx) => ({
          id: it.id ?? randomUUID(),
          node_id: nodeId,
          text: it.text.trim(),
          sort_order: idx,
        })),
      }),
    ]);
  }

  async bulkPosition(orgId: string, principal: Principal, mapId: string, dto: BulkPositionDto) {
    await this.access.assertCanViewMap(orgId, principal, mapId);
    const canEditWhole = await this.access.canEditMap(orgId, principal, mapId);
    const updates = [];
    for (const p of dto.positions) {
      const node = await this.prisma.processNode.findFirst({
        where: { id: p.id, map_id: mapId, organization_id: orgId, is_deleted: false },
        select: { id: true },
      });
      if (!node) continue;
      if (!canEditWhole && !(await this.access.canEditNode(orgId, principal, p.id))) continue;
      updates.push(
        this.prisma.processNode.update({
          where: { id: p.id },
          data: { position_x: p.position_x, position_y: p.position_y },
        }),
      );
    }
    if (updates.length) await this.prisma.$transaction(updates);
    return { updated: updates.length };
  }

  async deleteNode(orgId: string, principal: Principal, mapId: string, nodeId: string) {
    await this.requireNode(orgId, mapId, nodeId);
    await this.access.assertCanEditNode(orgId, principal, nodeId);

    // Collect the node + all descendants (soft-delete the subtree).
    const all = await this.prisma.processNode.findMany({
      where: { organization_id: orgId, map_id: mapId, is_deleted: false },
      select: { id: true, parent_node_id: true },
    });
    const childrenOf = new Map<string, string[]>();
    for (const n of all) {
      if (!n.parent_node_id) continue;
      (childrenOf.get(n.parent_node_id) ?? childrenOf.set(n.parent_node_id, []).get(n.parent_node_id)!).push(n.id);
    }
    const doomed: string[] = [];
    const stack = [nodeId];
    while (stack.length) {
      const id = stack.pop()!;
      doomed.push(id);
      stack.push(...(childrenOf.get(id) ?? []));
    }

    await this.prisma.$transaction([
      this.prisma.processConnection.deleteMany({
        where: {
          organization_id: orgId,
          map_id: mapId,
          OR: [
            { source_node_id: { in: doomed } },
            { target_node_id: { in: doomed } },
            { parent_node_id: { in: doomed } },
          ],
        },
      }),
      this.prisma.processNode.updateMany({
        where: { id: { in: doomed } },
        data: { is_deleted: true, deleted_at: new Date() },
      }),
    ]);
    return { deleted: doomed.length };
  }

  // ─── Connections ─────────────────────────────────────────────────────────────

  async createConnection(orgId: string, principal: Principal, mapId: string, dto: CreateConnectionDto) {
    const parentId = dto.parent_node_id ?? null;
    const [source, target] = await Promise.all([
      this.requireNode(orgId, mapId, dto.source_node_id),
      this.requireNode(orgId, mapId, dto.target_node_id),
    ]);
    if (source.parent_node_id !== parentId || target.parent_node_id !== parentId) {
      throw new BadRequestException('A connection can only join two steps in the same flow');
    }
    if (dto.source_node_id === dto.target_node_id) {
      throw new BadRequestException('A step cannot connect to itself');
    }
    if (parentId) await this.access.assertCanEditNode(orgId, principal, parentId);
    else await this.access.assertCanEditMap(orgId, principal, mapId);

    return this.prisma.processConnection.create({
      data: {
        organization_id: orgId,
        map_id: mapId,
        parent_node_id: parentId,
        source_node_id: dto.source_node_id,
        target_node_id: dto.target_node_id,
        label: dto.label ?? null,
        condition_kind: dto.condition_kind ?? 'none',
      },
    });
  }

  async updateConnection(orgId: string, principal: Principal, mapId: string, connId: string, dto: UpdateConnectionDto) {
    const conn = await this.prisma.processConnection.findFirst({
      where: { id: connId, map_id: mapId, organization_id: orgId },
    });
    if (!conn) throw new NotFoundException('Connection not found');
    if (conn.parent_node_id) await this.access.assertCanEditNode(orgId, principal, conn.parent_node_id);
    else await this.access.assertCanEditMap(orgId, principal, mapId);
    return this.prisma.processConnection.update({
      where: { id: connId },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.condition_kind !== undefined ? { condition_kind: dto.condition_kind } : {}),
      },
    });
  }

  async deleteConnection(orgId: string, principal: Principal, mapId: string, connId: string) {
    const conn = await this.prisma.processConnection.findFirst({
      where: { id: connId, map_id: mapId, organization_id: orgId },
    });
    if (!conn) throw new NotFoundException('Connection not found');
    if (conn.parent_node_id) await this.access.assertCanEditNode(orgId, principal, conn.parent_node_id);
    else await this.access.assertCanEditMap(orgId, principal, mapId);
    await this.prisma.processConnection.delete({ where: { id: connId } });
    return { success: true };
  }

  // ─── Artifacts ──────────────────────────────────────────────────────────────

  async listArtifacts(orgId: string, principal: Principal, mapId: string) {
    await this.access.assertCanViewMap(orgId, principal, mapId);
    return this.prisma.processArtifact.findMany({
      where: { organization_id: orgId, map_id: mapId },
      orderBy: { created_at: 'desc' },
    });
  }

  async createArtifact(orgId: string, principal: Principal, mapId: string, dto: CreateArtifactDto) {
    await this.access.assertCanEditMap(orgId, principal, mapId);
    return this.prisma.processArtifact.create({
      data: {
        organization_id: orgId,
        map_id: mapId,
        name: dto.name.trim(),
        description: dto.description ?? null,
        artifact_type: dto.artifact_type ?? 'document',
        created_by_user_id: principal.userId,
      },
    });
  }

  async uploadArtifact(orgId: string, principal: Principal, mapId: string, dto: CreateArtifactDto, file: UploadedFile) {
    await this.access.assertCanEditMap(orgId, principal, mapId);
    validateAttachmentFile(file);
    const key = `orgs/${orgId}/process-artifacts/${mapId}/${randomUUID()}.${extensionOf(file.originalname)}`;
    await this.r2.putObject(key, file.buffer, file.mimetype);
    return this.prisma.processArtifact.create({
      data: {
        organization_id: orgId,
        map_id: mapId,
        name: (dto.name || file.originalname).trim(),
        description: dto.description ?? null,
        artifact_type: dto.artifact_type ?? 'document',
        file_name: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
        storage_key: key,
        created_by_user_id: principal.userId,
      },
    });
  }

  async updateArtifact(orgId: string, principal: Principal, mapId: string, artifactId: string, dto: UpdateArtifactDto) {
    await this.access.assertCanEditMap(orgId, principal, mapId);
    const artifact = await this.requireArtifact(orgId, mapId, artifactId);
    return this.prisma.processArtifact.update({
      where: { id: artifact.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.artifact_type !== undefined ? { artifact_type: dto.artifact_type } : {}),
      },
    });
  }

  async deleteArtifact(orgId: string, principal: Principal, mapId: string, artifactId: string) {
    await this.access.assertCanEditMap(orgId, principal, mapId);
    const artifact = await this.requireArtifact(orgId, mapId, artifactId);
    if (artifact.storage_key) await this.r2.deleteObject(artifact.storage_key);
    await this.prisma.processArtifact.delete({ where: { id: artifact.id } }); // cascades node links
    return { success: true };
  }

  async downloadArtifact(orgId: string, principal: Principal, mapId: string, artifactId: string) {
    await this.access.assertCanViewMap(orgId, principal, mapId);
    const artifact = await this.requireArtifact(orgId, mapId, artifactId);
    if (!artifact.storage_key) throw new BadRequestException('This artifact has no attached file');
    const url = await this.r2.getSignedDownloadUrl(artifact.storage_key, artifact.file_name ?? artifact.name);
    return { url };
  }

  private async requireArtifact(orgId: string, mapId: string, artifactId: string) {
    const artifact = await this.prisma.processArtifact.findFirst({
      where: { id: artifactId, map_id: mapId, organization_id: orgId },
    });
    if (!artifact) throw new NotFoundException('Artifact not found');
    return artifact;
  }

  async linkArtifact(orgId: string, principal: Principal, mapId: string, nodeId: string, dto: LinkArtifactDto) {
    await this.requireNode(orgId, mapId, nodeId);
    await this.access.assertCanEditNode(orgId, principal, nodeId);
    await this.requireArtifact(orgId, mapId, dto.artifact_id);
    return this.prisma.processNodeArtifact.upsert({
      where: {
        node_id_artifact_id_direction: {
          node_id: nodeId,
          artifact_id: dto.artifact_id,
          direction: dto.direction,
        },
      },
      create: { node_id: nodeId, artifact_id: dto.artifact_id, direction: dto.direction },
      update: {},
    });
  }

  async unlinkArtifact(orgId: string, principal: Principal, mapId: string, nodeId: string, linkId: string) {
    await this.requireNode(orgId, mapId, nodeId);
    await this.access.assertCanEditNode(orgId, principal, nodeId);
    const res = await this.prisma.processNodeArtifact.deleteMany({ where: { id: linkId, node_id: nodeId } });
    if (res.count === 0) throw new NotFoundException('Artifact link not found');
    return { success: true };
  }

  // ─── Access / sharing ─────────────────────────────────────────────────────────

  async listNodeAccess(orgId: string, principal: Principal, mapId: string, nodeId: string) {
    await this.requireNode(orgId, mapId, nodeId);
    await this.access.assertCanEditNode(orgId, principal, nodeId); // managing sharing is an edit concern
    const rules = await this.prisma.processNodeAccess.findMany({ where: { organization_id: orgId, node_id: nodeId } });
    return this.enrichAccessRules(orgId, rules);
  }

  async addAccessRule(orgId: string, principal: Principal, mapId: string, nodeId: string, dto: AddAccessRuleDto) {
    await this.requireNode(orgId, mapId, nodeId);
    await this.access.assertCanEditNode(orgId, principal, nodeId);
    this.validateAccessDto(dto);
    const rule = await this.prisma.processNodeAccess.create({
      data: {
        organization_id: orgId,
        node_id: nodeId,
        kind: dto.kind,
        level: dto.kind === ProcessAccessKind.exclude_user ? ProcessAccessLevel.view : dto.level ?? ProcessAccessLevel.view,
        department_id: dto.kind === ProcessAccessKind.department ? dto.department_id ?? null : null,
        include_sub_departments: dto.include_sub_departments ?? true,
        role_id: dto.kind === ProcessAccessKind.role ? dto.role_id ?? null : null,
        user_id:
          dto.kind === ProcessAccessKind.user || dto.kind === ProcessAccessKind.exclude_user
            ? dto.user_id ?? null
            : null,
        created_by_user_id: principal.userId,
      },
    });
    return (await this.enrichAccessRules(orgId, [rule]))[0];
  }

  async removeAccessRule(orgId: string, principal: Principal, mapId: string, nodeId: string, ruleId: string) {
    await this.requireNode(orgId, mapId, nodeId);
    await this.access.assertCanEditNode(orgId, principal, nodeId);
    const res = await this.prisma.processNodeAccess.deleteMany({ where: { id: ruleId, node_id: nodeId, organization_id: orgId } });
    if (res.count === 0) throw new NotFoundException('Access rule not found');
    return { success: true };
  }

  private validateAccessDto(dto: AddAccessRuleDto) {
    if (dto.kind === ProcessAccessKind.department && !dto.department_id) {
      throw new BadRequestException('department_id is required for a department attachment');
    }
    if (dto.kind === ProcessAccessKind.role && !dto.role_id) {
      throw new BadRequestException('role_id is required for a role attachment');
    }
    if ((dto.kind === ProcessAccessKind.user || dto.kind === ProcessAccessKind.exclude_user) && !dto.user_id) {
      throw new BadRequestException('user_id is required for a person attachment');
    }
  }

  /** Attach human-readable labels (dept name / role title / person name) for the UI. */
  private async enrichAccessRules(orgId: string, rules: any[]) {
    if (rules.length === 0) return [];
    const deptIds = rules.map((r) => r.department_id).filter(Boolean) as string[];
    const roleIds = rules.map((r) => r.role_id).filter(Boolean) as string[];
    const userIds = rules.map((r) => r.user_id).filter(Boolean) as string[];
    const [depts, roles, users] = await Promise.all([
      deptIds.length ? this.prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } }) : [],
      roleIds.length ? this.prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, title: true } }) : [],
      userIds.length ? this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [],
    ]);
    const deptName = new Map(depts.map((d) => [d.id, d.name]));
    const roleName = new Map(roles.map((r) => [r.id, r.title]));
    const userName = new Map(users.map((u) => [u.id, u.name]));
    return rules.map((r) => ({
      ...r,
      label:
        r.kind === 'department'
          ? deptName.get(r.department_id) ?? 'Department'
          : r.kind === 'role'
            ? roleName.get(r.role_id) ?? 'Role'
            : userName.get(r.user_id) ?? 'Person',
    }));
  }

  // ─── Snapshots (create + restore; DIFF is Phase 2) ─────────────────────────────

  async listSnapshots(orgId: string, principal: Principal, mapId: string) {
    await this.access.assertCanViewMap(orgId, principal, mapId);
    return this.prisma.processSnapshot.findMany({
      where: { organization_id: orgId, map_id: mapId },
      orderBy: { created_at: 'desc' },
      select: { id: true, label: true, status: true, created_by_user_id: true, created_at: true },
    });
  }

  async createSnapshot(orgId: string, principal: Principal, mapId: string, dto: CreateSnapshotDto) {
    await this.access.assertCanEditMap(orgId, principal, mapId);
    const tree = await this.serializeMap(orgId, mapId);
    return this.prisma.processSnapshot.create({
      data: {
        organization_id: orgId,
        map_id: mapId,
        label: dto.label.trim(),
        status: dto.status ?? 'draft',
        tree_json: tree,
        created_by_user_id: principal.userId,
      },
      select: { id: true, label: true, status: true, created_by_user_id: true, created_at: true },
    });
  }

  private async serializeMap(orgId: string, mapId: string) {
    const [nodes, connections, artifacts, links, checklist, access] = await Promise.all([
      this.prisma.processNode.findMany({ where: { organization_id: orgId, map_id: mapId, is_deleted: false } }),
      this.prisma.processConnection.findMany({ where: { organization_id: orgId, map_id: mapId } }),
      this.prisma.processArtifact.findMany({ where: { organization_id: orgId, map_id: mapId } }),
      this.prisma.processNodeArtifact.findMany({ where: { node: { organization_id: orgId, map_id: mapId } } }),
      this.prisma.processChecklistItem.findMany({ where: { node: { organization_id: orgId, map_id: mapId } } }),
      this.prisma.processNodeAccess.findMany({ where: { organization_id: orgId, node: { map_id: mapId } } }),
    ]);
    // JSON round-trip converts Date instances to ISO strings so the value satisfies
    // Prisma's Json input type (and restore feeds the strings straight back to createMany,
    // which accepts ISO-8601 for DateTime columns).
    return JSON.parse(JSON.stringify({ version: 1, nodes, connections, artifacts, links, checklist, access }));
  }

  async restoreSnapshot(orgId: string, principal: Principal, mapId: string, snapshotId: string) {
    await this.access.assertCanEditMap(orgId, principal, mapId);
    const snap = await this.prisma.processSnapshot.findFirst({
      where: { id: snapshotId, map_id: mapId, organization_id: orgId },
    });
    if (!snap) throw new NotFoundException('Snapshot not found');
    const tree = snap.tree_json as any;

    await this.prisma.$transaction(async (tx) => {
      // Wipe the working tree (hard delete — the snapshot is the source of truth).
      await tx.processConnection.deleteMany({ where: { organization_id: orgId, map_id: mapId } });
      await tx.processNodeArtifact.deleteMany({ where: { node: { organization_id: orgId, map_id: mapId } } });
      await tx.processChecklistItem.deleteMany({ where: { node: { organization_id: orgId, map_id: mapId } } });
      await tx.processNodeAccess.deleteMany({ where: { organization_id: orgId, node: { map_id: mapId } } });
      await tx.processNode.deleteMany({ where: { organization_id: orgId, map_id: mapId } });
      await tx.processArtifact.deleteMany({ where: { organization_id: orgId, map_id: mapId } });

      // Recreate from the snapshot (ids preserved so relations resolve).
      if (tree.artifacts?.length) await tx.processArtifact.createMany({ data: tree.artifacts });
      if (tree.nodes?.length) await tx.processNode.createMany({ data: tree.nodes });
      if (tree.connections?.length) await tx.processConnection.createMany({ data: tree.connections });
      if (tree.links?.length) await tx.processNodeArtifact.createMany({ data: tree.links });
      if (tree.checklist?.length) await tx.processChecklistItem.createMany({ data: tree.checklist });
      if (tree.access?.length) await tx.processNodeAccess.createMany({ data: tree.access });
    });
    return { success: true };
  }

  // ─── Diff (as-is vs to-be) ─────────────────────────────────────────────────────

  /** Resolve a tree ref: 'live' → serialize the working map; else a snapshot id. */
  private async treeFor(orgId: string, mapId: string, ref: string): Promise<any> {
    if (ref === 'live') return this.serializeMap(orgId, mapId);
    const snap = await this.prisma.processSnapshot.findFirst({
      where: { id: ref, map_id: mapId, organization_id: orgId },
      select: { tree_json: true },
    });
    if (!snap) throw new NotFoundException('Snapshot not found');
    return snap.tree_json;
  }

  async diff(
    orgId: string,
    principal: Principal,
    mapId: string,
    base: string,
    target: string,
  ): Promise<MapDiff & { base: string; target: string }> {
    await this.access.assertCanViewMap(orgId, principal, mapId);
    const [b, t] = await Promise.all([this.treeFor(orgId, mapId, base), this.treeFor(orgId, mapId, target)]);
    return { base, target, ...computeMapDiff(b, t) };
  }

  // ─── Status workflow (draft → in_review → final) ───────────────────────────────

  /** node + all descendants (ids), scoped to the map. */
  private async subtreeIds(orgId: string, mapId: string, nodeId: string): Promise<string[]> {
    const all = await this.prisma.processNode.findMany({
      where: { organization_id: orgId, map_id: mapId, is_deleted: false },
      select: { id: true, parent_node_id: true },
    });
    const childrenOf = new Map<string, string[]>();
    for (const n of all) {
      if (!n.parent_node_id) continue;
      (childrenOf.get(n.parent_node_id) ?? childrenOf.set(n.parent_node_id, []).get(n.parent_node_id)!).push(n.id);
    }
    const out: string[] = [];
    const stack = [nodeId];
    const seen = new Set<string>();
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      stack.push(...(childrenOf.get(id) ?? []));
    }
    return out;
  }

  async requestReview(orgId: string, principal: Principal, mapId: string, nodeId: string, cascade: boolean) {
    const node = await this.requireNode(orgId, mapId, nodeId);
    await this.access.assertCanEditNode(orgId, principal, nodeId);
    const ids = cascade ? await this.subtreeIds(orgId, mapId, nodeId) : [nodeId];
    await this.prisma.processNode.updateMany({
      where: { id: { in: ids }, organization_id: orgId },
      data: { status: ProcessNodeStatus.in_review },
    });
    const map = await this.prisma.processMap.findFirst({
      where: { id: mapId },
      select: { created_by_user_id: true, name: true },
    });
    if (map && map.created_by_user_id !== principal.userId) {
      const who = await this.notifications.userName(principal.userId).catch(() => 'Someone');
      await this.notifications.emit({
        orgId,
        module: 'process_hierarchy',
        event_type: 'process_review_requested',
        recipients: [map.created_by_user_id],
        title: 'Process review requested',
        body: `${who} sent "${node.name}" in ${map.name} for review.`,
        link: `/dashboard/process-hierarchy/${mapId}`,
        entity: { type: 'process_node', id: nodeId },
        dedupe: true,
      });
    }
    return { updated: ids.length };
  }

  async decideStatus(
    orgId: string,
    principal: Principal,
    mapId: string,
    nodeId: string,
    status: ProcessNodeStatus,
    cascade: boolean,
  ) {
    const node = await this.requireNode(orgId, mapId, nodeId);
    await this.access.assertCanEditMap(orgId, principal, mapId); // approve / send-back = owner or admin
    const ids = cascade ? await this.subtreeIds(orgId, mapId, nodeId) : [nodeId];
    await this.prisma.processNode.updateMany({
      where: { id: { in: ids }, organization_id: orgId },
      data: { status },
    });
    const recipients = Array.from(
      new Set(
        [node.responsible_user_id, node.created_by_user_id].filter(
          (x): x is string => !!x && x !== principal.userId,
        ),
      ),
    );
    if (recipients.length && (status === ProcessNodeStatus.final || status === ProcessNodeStatus.draft)) {
      const map = await this.prisma.processMap.findFirst({ where: { id: mapId }, select: { name: true } });
      await this.notifications.emit({
        orgId,
        module: 'process_hierarchy',
        event_type: status === ProcessNodeStatus.final ? 'process_finalized' : 'process_sent_back',
        recipients,
        title: status === ProcessNodeStatus.final ? 'Process marked final' : 'Process sent back to draft',
        body: `"${node.name}" in ${map?.name ?? 'a process map'} was ${
          status === ProcessNodeStatus.final ? 'marked final' : 'sent back to draft'
        }.`,
        link: `/dashboard/process-hierarchy/${mapId}`,
        entity: { type: 'process_node', id: nodeId },
      });
    }
    return { updated: ids.length };
  }

  // ─── Templates (reusable process blueprints) ───────────────────────────────────

  async saveAsTemplate(orgId: string, principal: Principal, mapId: string, name: string, description?: string) {
    await this.access.assertCanViewMap(orgId, principal, mapId);
    const tree = await this.serializeMap(orgId, mapId);
    return this.prisma.processTemplate.create({
      data: {
        organization_id: orgId,
        name: name.trim(),
        description: description ?? null,
        tree_json: tree,
        source_map_id: mapId,
        created_by_user_id: principal.userId,
      },
      select: { id: true, name: true, description: true, created_by_user_id: true, created_at: true },
    });
  }

  async listTemplates(orgId: string) {
    return this.prisma.processTemplate.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'desc' },
      select: { id: true, name: true, description: true, created_by_user_id: true, created_at: true },
    });
  }

  async deleteTemplate(orgId: string, principal: Principal, templateId: string) {
    const tpl = await this.prisma.processTemplate.findFirst({
      where: { id: templateId, organization_id: orgId },
      select: { id: true, created_by_user_id: true },
    });
    if (!tpl) throw new NotFoundException('Template not found');
    if (!principal.isAdmin && tpl.created_by_user_id !== principal.userId) {
      throw new ForbiddenException('Only the template creator or an administrator can delete it');
    }
    await this.prisma.processTemplate.delete({ where: { id: templateId } });
    return { success: true };
  }

  /** Create a brand-new map from a template, cloning the tree with fresh ids. */
  async instantiateTemplate(orgId: string, principal: Principal, templateId: string, name: string) {
    const tpl = await this.prisma.processTemplate.findFirst({
      where: { id: templateId, organization_id: orgId },
    });
    if (!tpl) throw new NotFoundException('Template not found');
    const tree = tpl.tree_json as any;

    const map = await this.prisma.processMap.create({
      data: {
        organization_id: orgId,
        name: name.trim(),
        description: null,
        created_by_user_id: principal.userId,
      },
    });

    // Fresh-id maps so every internal reference is rewired to the new rows.
    const nodeId = new Map<string, string>();
    const artifactId = new Map<string, string>();
    for (const n of tree.nodes ?? []) nodeId.set(n.id, randomUUID());
    for (const a of tree.artifacts ?? []) artifactId.set(a.id, randomUUID());

    // Copy any real files to new R2 keys so deleting one map never orphans another's bytes.
    const artifactRows: any[] = [];
    for (const a of tree.artifacts ?? []) {
      const newId = artifactId.get(a.id)!;
      let storageKey: string | null = a.storage_key ?? null;
      if (a.storage_key) {
        const destKey = `orgs/${orgId}/process-artifacts/${map.id}/${newId}.${extensionOf(a.file_name ?? '')}`;
        try {
          await this.r2.copyObject(a.storage_key, destKey);
          storageKey = destKey;
        } catch {
          storageKey = a.storage_key; // fall back to sharing the object if copy is unavailable
        }
      }
      artifactRows.push({
        id: newId,
        organization_id: orgId,
        map_id: map.id,
        name: a.name,
        description: a.description ?? null,
        artifact_type: a.artifact_type,
        file_name: a.file_name ?? null,
        mime_type: a.mime_type ?? null,
        size_bytes: a.size_bytes ?? null,
        storage_key: storageKey,
        created_by_user_id: principal.userId,
      });
    }

    const nodeRows = (tree.nodes ?? []).map((n: any) => ({
      id: nodeId.get(n.id)!,
      organization_id: orgId,
      map_id: map.id,
      parent_node_id: n.parent_node_id ? nodeId.get(n.parent_node_id) ?? null : null,
      kind: n.kind,
      name: n.name,
      description: n.description ?? null,
      status: n.status,
      responsible_role_id: n.responsible_role_id ?? null,
      responsible_user_id: n.responsible_user_id ?? null,
      position_x: n.position_x ?? 0,
      position_y: n.position_y ?? 0,
      sort_order: n.sort_order ?? 0,
      linked_map_id: n.linked_map_id ?? null, // cross-map links still point at real maps
      created_by_user_id: principal.userId,
    }));

    const connectionRows = (tree.connections ?? [])
      .filter((c: any) => nodeId.has(c.source_node_id) && nodeId.has(c.target_node_id))
      .map((c: any) => ({
        id: randomUUID(),
        organization_id: orgId,
        map_id: map.id,
        parent_node_id: c.parent_node_id ? nodeId.get(c.parent_node_id) ?? null : null,
        source_node_id: nodeId.get(c.source_node_id)!,
        target_node_id: nodeId.get(c.target_node_id)!,
        label: c.label ?? null,
        condition_kind: c.condition_kind ?? 'none',
      }));

    const linkRows = (tree.links ?? [])
      .filter((l: any) => nodeId.has(l.node_id) && artifactId.has(l.artifact_id))
      .map((l: any) => ({
        id: randomUUID(),
        node_id: nodeId.get(l.node_id)!,
        artifact_id: artifactId.get(l.artifact_id)!,
        direction: l.direction,
      }));

    const checklistRows = (tree.checklist ?? [])
      .filter((c: any) => nodeId.has(c.node_id))
      .map((c: any) => ({ id: randomUUID(), node_id: nodeId.get(c.node_id)!, text: c.text, sort_order: c.sort_order ?? 0 }));

    const accessRows = (tree.access ?? [])
      .filter((a: any) => nodeId.has(a.node_id))
      .map((a: any) => ({
        id: randomUUID(),
        organization_id: orgId,
        node_id: nodeId.get(a.node_id)!,
        kind: a.kind,
        level: a.level,
        department_id: a.department_id ?? null,
        include_sub_departments: a.include_sub_departments ?? true,
        role_id: a.role_id ?? null,
        user_id: a.user_id ?? null,
        created_by_user_id: principal.userId,
      }));

    await this.prisma.$transaction(async (tx) => {
      if (artifactRows.length) await tx.processArtifact.createMany({ data: artifactRows });
      if (nodeRows.length) await tx.processNode.createMany({ data: nodeRows });
      if (connectionRows.length) await tx.processConnection.createMany({ data: connectionRows });
      if (linkRows.length) await tx.processNodeArtifact.createMany({ data: linkRows });
      if (checklistRows.length) await tx.processChecklistItem.createMany({ data: checklistRows });
      if (accessRows.length) await tx.processNodeAccess.createMany({ data: accessRows });
    });

    return map;
  }
}
