import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditAction = 'create' | 'update' | 'delete';

export interface AuditChange {
  before: unknown;
  after: unknown;
}

export interface RecordAuditInput {
  orgId: string;
  actorId: string;
  action: AuditAction;
  resource: string;
  entityId: string;
  entityLabel?: string | null;
  changes?: Record<string, AuditChange> | null;
}

export interface AuditListFilters {
  resource?: string;
  entity_id?: string;
  action?: string;
  actor_user_id?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  skip?: number;
  take?: number;
}

/**
 * Shared, software-wide audit log. Any module injects this and calls `record()`
 * to emit an actor/action/entity/before→after entry to the single `audit_logs`
 * table. Exported from a global module so it is available everywhere.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organization_id: input.orgId,
        actor_user_id: input.actorId,
        action: input.action,
        resource: input.resource,
        entity_id: input.entityId,
        entity_label: input.entityLabel ?? null,
        changes: (input.changes ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /**
   * Build a { field: { before, after } } diff for the changed fields only.
   * Dates are compared by ISO value so equal timestamps don't register a change.
   */
  diff<T extends Record<string, any>>(
    before: T,
    after: Partial<T>,
    fields: (keyof T)[],
  ): Record<string, AuditChange> | null {
    const changes: Record<string, AuditChange> = {};
    for (const f of fields) {
      if (!(f in after)) continue;
      const b = normalize(before[f]);
      const a = normalize(after[f]);
      if (b !== a) {
        changes[f as string] = { before: before[f] ?? null, after: after[f] ?? null };
      }
    }
    return Object.keys(changes).length ? changes : null;
  }

  async list(orgId: string, filters: AuditListFilters = {}) {
    const where: Prisma.AuditLogWhereInput = { organization_id: orgId };
    if (filters.resource) where.resource = filters.resource;
    if (filters.entity_id) where.entity_id = filters.entity_id;
    if (filters.action) where.action = filters.action;
    if (filters.actor_user_id) where.actor_user_id = filters.actor_user_id;
    if (filters.from_date || filters.to_date) {
      where.created_at = {};
      if (filters.from_date) where.created_at.gte = new Date(filters.from_date);
      if (filters.to_date) where.created_at.lte = new Date(filters.to_date);
    }
    if (filters.search) {
      where.OR = [
        { entity_label: { contains: filters.search, mode: 'insensitive' } },
        { entity_id: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const take = Math.min(filters.take ?? 100, 200);
    const skip = filters.skip ?? 0;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, skip, take };
  }
}

function normalize(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  return v;
}
