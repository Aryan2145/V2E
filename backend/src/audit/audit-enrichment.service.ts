import { Injectable, Logger } from '@nestjs/common';
import { PrismaBaseService } from '../prisma/prisma-base.service';
import {
  auditConfigFor,
  GLOBAL_RELATION_LABELS,
  RelationHint,
} from './auditable-models';

/** Default label column per relation-target model. */
const TARGET_LABEL_FIELD: Record<string, string> = {
  User: 'name',
  Department: 'name',
  Role: 'name',
  SystemRole: 'name',
  TaskStatus: 'name',
  TaskPriority: 'name',
  TaskCategory: 'name',
  TicketStatus: 'name',
  TicketPriority: 'name',
  TicketCategory: 'name',
  TicketType: 'name',
  Goal: 'title',
  Project: 'name',
  WorkflowTemplate: 'name',
};

interface ChangeVal {
  before: unknown;
  after: unknown;
}
type Changes = Record<string, ChangeVal>;

interface AuditRowLike {
  resource: string;
  entity_type: string | null;
  changes: unknown;
  [k: string]: unknown;
}

const camel = (model: string) => model.charAt(0).toLowerCase() + model.slice(1);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length >= 8;

/**
 * Resolves relation IDs in audit `changes` to human labels at READ time. Keeping
 * resolution off the write path means user mutations stay cheap; a page of audit
 * rows (≤200) is enriched with a handful of batched lookups. This also fixes the
 * legacy `String(before)` breakage for objects/relations.
 */
@Injectable()
export class AuditEnrichmentService {
  private readonly logger = new Logger(AuditEnrichmentService.name);

  constructor(private readonly base: PrismaBaseService) {}

  private relationMapFor(entityType: string | null): Record<string, RelationHint> {
    const cfg = entityType ? auditConfigFor(entityType) : null;
    return { ...GLOBAL_RELATION_LABELS, ...(cfg?.relationLabels ?? {}) };
  }

  /** Enrich a page of audit rows in place-ish, returning new objects. */
  async enrich<T extends AuditRowLike>(rows: T[]): Promise<T[]> {
    if (!rows.length) return rows;

    // Pass 1 — collect (model → ids) to resolve.
    const pending = new Map<string, Set<string>>();
    for (const row of rows) {
      const changes = row.changes as Changes | null;
      if (!changes) continue;
      const relMap = this.relationMapFor(row.entity_type);
      for (const [field, val] of Object.entries(changes)) {
        const hint = relMap[field];
        if (!hint) continue;
        for (const v of [val?.before, val?.after]) {
          if (isId(v)) {
            if (!pending.has(hint.model)) pending.set(hint.model, new Set());
            pending.get(hint.model)!.add(v);
          }
        }
      }
    }

    // Resolve each target model in one query.
    const labels = new Map<string, string>(); // `${model}:${id}` → label
    await Promise.all(
      [...pending.entries()].map(async ([model, ids]) => {
        const delegate = (this.base as Record<string, any>)[camel(model)];
        if (!delegate?.findMany) return;
        const labelField = TARGET_LABEL_FIELD[model] ?? 'name';
        const select: Record<string, boolean> = { id: true, [labelField]: true };
        if (model === 'User') select['email'] = true;
        try {
          const found = await delegate.findMany({ where: { id: { in: [...ids] } }, select });
          for (const r of found) {
            const label = r[labelField] ?? (model === 'User' ? r['email'] : null) ?? r.id;
            labels.set(`${model}:${r.id}`, String(label));
          }
        } catch (err) {
          this.logger.warn(`Audit enrich failed for ${model}: ${(err as Error).message}`);
        }
      }),
    );

    // Pass 2 — rewrite relation values to labels.
    return rows.map((row) => {
      const changes = row.changes as Changes | null;
      if (!changes) return row;
      const relMap = this.relationMapFor(row.entity_type);
      const out: Changes = {};
      for (const [field, val] of Object.entries(changes)) {
        const hint = relMap[field];
        if (!hint) {
          out[field] = val;
          continue;
        }
        out[field] = {
          before: this.resolveOne(hint.model, val?.before, labels),
          after: this.resolveOne(hint.model, val?.after, labels),
        };
      }
      return { ...row, changes: out };
    });
  }

  private resolveOne(model: string, value: unknown, labels: Map<string, string>): unknown {
    if (!isId(value)) return value ?? null;
    return labels.get(`${model}:${value}`) ?? value;
  }
}
