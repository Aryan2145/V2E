import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaBaseService } from '../prisma/prisma-base.service';
import {
  AuditBufferEntry,
  AuditContextService,
  SystemRunParams,
} from '../common/cls/audit-context.service';

/**
 * Flushes buffered audit entries to `audit_logs`. Audit persistence must never
 * fail a user's mutation, so all writes are wrapped in try/catch and pushed out
 * of the request path (setImmediate). Uses the BASE client so audit writes are
 * not themselves intercepted by the capture extension.
 */
@Injectable()
export class AuditWriterService {
  private readonly logger = new Logger(AuditWriterService.name);

  constructor(
    private readonly base: PrismaBaseService,
    private readonly ctx: AuditContextService,
  ) {}

  /**
   * Drain the current context's buffer and persist it after the response, off
   * the request path. Must be called while the CLS context is still active.
   */
  flushAfterResponse(): void {
    const entries = this.ctx.drain();
    if (!entries.length) return;
    setImmediate(() => {
      void this.write(entries);
    });
  }

  /** Persist buffered entries inline (awaited). Used by system runs. */
  async flushNow(): Promise<void> {
    const entries = this.ctx.drain();
    if (entries.length) await this.write(entries);
  }

  /**
   * Run a cron/replay engine pass attributed to the system actor with trigger
   * context, then flush whatever it produced. Engines wrap their per-org passes
   * in this so every system-derived change is captured and de-duped correctly.
   */
  async runAsSystem<T>(params: SystemRunParams, fn: () => Promise<T>): Promise<T> {
    return this.ctx.runAsSystem(params, async () => {
      try {
        return await fn();
      } finally {
        await this.flushNow();
      }
    });
  }

  private async write(entries: AuditBufferEntry[]): Promise<void> {
    try {
      await this.base.auditLog.createMany({
        data: entries.map((e) => ({
          organization_id: e.organization_id,
          actor_user_id: e.actor_user_id,
          actor_type: e.actor_type,
          action: e.action,
          resource: e.resource,
          entity_id: e.entity_id,
          entity_label: e.entity_label,
          entity_type: e.entity_type,
          changes: (e.changes ?? undefined) as Prisma.InputJsonValue | undefined,
          trigger_source: e.trigger_source,
          trigger_context: (e.trigger_context ?? undefined) as Prisma.InputJsonValue | undefined,
          occurred_at: e.occurred_at,
          request_id: e.request_id,
          ip: e.ip,
          user_agent: e.user_agent,
        })),
      });
    } catch (err) {
      this.logger.error(
        `Failed to persist ${entries.length} audit entr${entries.length === 1 ? 'y' : 'ies'}: ${
          (err as Error).message
        }`,
      );
    }
  }
}
