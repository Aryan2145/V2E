import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

export type ActorType = 'user' | 'system';

/**
 * A single pending audit entry, shaped to match the `audit_logs` columns so the
 * writer can `createMany` without further mapping.
 */
export interface AuditBufferEntry {
  organization_id: string;
  actor_user_id: string | null;
  actor_type: ActorType;
  action: string;
  resource: string;
  entity_id: string;
  entity_label: string | null;
  entity_type: string | null;
  changes: unknown | null;
  trigger_source: string | null;
  trigger_context: unknown | null;
  occurred_at: Date;
  request_id: string | null;
  ip: string | null;
  user_agent: string | null;
}

export interface SystemRunParams {
  orgId: string;
  triggerSource: string;
  triggerContext?: Record<string, unknown> | null;
  /** Business time for the run — use clock.now(orgId) so replays are deterministic. */
  occurredAt?: Date;
  actorId?: string | null;
}

/** CLS keys — namespaced to avoid collisions with any other CLS usage. */
const K = {
  orgId: 'audit:orgId',
  actorId: 'audit:actorId',
  actorType: 'audit:actorType',
  requestId: 'audit:requestId',
  ip: 'audit:ip',
  userAgent: 'audit:userAgent',
  triggerSource: 'audit:triggerSource',
  triggerContext: 'audit:triggerContext',
  occurredAt: 'audit:occurredAt',
  handled: 'audit:handled',
  buffer: 'audit:buffer',
} as const;

/**
 * Typed accessors over the request/run-scoped CLS store. Carries the actor, org
 * and trigger context from the HTTP boundary (or a system run) all the way down
 * to the Prisma audit extension, with no parameter threading.
 *
 * Holds no DB dependency — pure async-local state — so it can be injected into
 * the Prisma layer without creating a cycle.
 */
@Injectable()
export class AuditContextService {
  constructor(private readonly cls: ClsService) {}

  /** True when there is an active CLS context (an HTTP request or a system run). */
  get isActive(): boolean {
    return this.cls.isActive();
  }

  get orgId(): string | null {
    return this.read<string>(K.orgId);
  }
  set orgId(v: string | null) {
    this.write(K.orgId, v);
  }

  get actorId(): string | null {
    return this.read<string>(K.actorId);
  }
  set actorId(v: string | null) {
    this.write(K.actorId, v);
  }

  get actorType(): ActorType {
    return this.read<ActorType>(K.actorType) ?? 'user';
  }
  set actorType(v: ActorType) {
    this.write(K.actorType, v);
  }

  get requestId(): string | null {
    return this.read<string>(K.requestId);
  }
  set requestId(v: string | null) {
    this.write(K.requestId, v);
  }

  get ip(): string | null {
    return this.read<string>(K.ip);
  }
  set ip(v: string | null) {
    this.write(K.ip, v);
  }

  get userAgent(): string | null {
    return this.read<string>(K.userAgent);
  }
  set userAgent(v: string | null) {
    this.write(K.userAgent, v);
  }

  get triggerSource(): string | null {
    return this.read<string>(K.triggerSource);
  }
  set triggerSource(v: string | null) {
    this.write(K.triggerSource, v);
  }

  get triggerContext(): Record<string, unknown> | null {
    return this.read<Record<string, unknown>>(K.triggerContext);
  }
  set triggerContext(v: Record<string, unknown> | null) {
    this.write(K.triggerContext, v);
  }

  get occurredAt(): Date | null {
    return this.read<Date>(K.occurredAt);
  }
  set occurredAt(v: Date | null) {
    this.write(K.occurredAt, v);
  }

  // ─── De-dupe between explicit record() and the automatic extension ──────────
  private handledSet(): Set<string> {
    let s = this.read<Set<string>>(K.handled);
    if (!s) {
      s = new Set<string>();
      this.write(K.handled, s);
    }
    return s;
  }

  /** Mark an entity as already logged by an explicit semantic record(). */
  markHandled(resource: string, entityId: string): void {
    if (!this.isActive) return;
    this.handledSet().add(`${resource}:${entityId}`);
  }

  isHandled(resource: string, entityId: string): boolean {
    if (!this.isActive) return false;
    return this.handledSet().has(`${resource}:${entityId}`);
  }

  // ─── Pending-entry buffer (flushed by AuditWriterService) ───────────────────
  private bufferArr(): AuditBufferEntry[] {
    let b = this.read<AuditBufferEntry[]>(K.buffer);
    if (!b) {
      b = [];
      this.write(K.buffer, b);
    }
    return b;
  }

  push(entry: AuditBufferEntry): void {
    if (!this.isActive) return;
    this.bufferArr().push(entry);
  }

  /** Return and clear all pending entries (call while still inside the context). */
  drain(): AuditBufferEntry[] {
    if (!this.isActive) return [];
    const b = this.bufferArr();
    if (!b.length) return [];
    this.write(K.buffer, []);
    return b;
  }

  /**
   * Open a fresh CLS context for a system-triggered run (cron / replay). Inside,
   * writes auto-attribute to actor_type='system' with the given trigger context.
   * The caller (AuditWriterService.runAsSystem) is responsible for flushing.
   */
  runAsSystem<T>(params: SystemRunParams, fn: () => Promise<T>): Promise<T> {
    return this.cls.run(async () => {
      this.orgId = params.orgId;
      this.actorId = params.actorId ?? null;
      this.actorType = 'system';
      this.triggerSource = params.triggerSource;
      this.triggerContext = params.triggerContext ?? null;
      this.occurredAt = params.occurredAt ?? new Date();
      return fn();
    });
  }

  private read<T>(key: string): T | null {
    if (!this.cls.isActive()) return null;
    return (this.cls.get(key) as T) ?? null;
  }

  private write(key: string, value: unknown): void {
    if (!this.cls.isActive()) return;
    this.cls.set(key, value);
  }
}
