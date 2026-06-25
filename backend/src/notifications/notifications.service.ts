import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { PushService } from './push.service';
import { NotifModule } from './notification-events';
import { TERMINAL_TYPES } from '../tasks/status-phase';

export interface EmitParams {
  orgId: string;
  module: NotifModule;
  event_type: string;
  recipients: (string | null | undefined)[];
  title: string;
  body: string;
  link?: string | null;
  entity?: { type: string; id: string };
  /** Skip recipients who already have a notification for (event_type, entity). */
  dedupe?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  // Master config cache (like ClockService): orgId → { value, expires }
  private readonly masterCache = new Map<string, { value: any; expires: number }>();
  private readonly TTL_MS = 5_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly push: PushService,
  ) {}

  // ─── Master config ───────────────────────────────────────────────────────────

  async getMaster(orgId: string) {
    const cached = this.masterCache.get(orgId);
    if (cached && cached.expires > Date.now()) return cached.value;

    const master = await this.prisma.notificationMaster.upsert({
      where: { organization_id: orgId },
      create: { organization_id: orgId },
      update: {},
    });
    this.masterCache.set(orgId, { value: master, expires: Date.now() + this.TTL_MS });
    return master;
  }

  async updateMaster(orgId: string, dto: { event_toggles?: Record<string, boolean>; overdue_followup_days?: number }) {
    const data: any = {};
    if (dto.event_toggles !== undefined) data.event_toggles = dto.event_toggles;
    if (dto.overdue_followup_days !== undefined) {
      data.overdue_followup_days = Math.max(1, Math.min(365, Math.floor(dto.overdue_followup_days)));
    }
    const master = await this.prisma.notificationMaster.upsert({
      where: { organization_id: orgId },
      create: { organization_id: orgId, ...data },
      update: data,
    });
    this.masterCache.delete(orgId);
    return master;
  }

  // ─── Emit (the single choke point) ──────────────────────────────────────────

  async emit(p: EmitParams): Promise<number> {
    try {
      const master = await this.getMaster(p.orgId);
      const toggles = (master.event_toggles ?? {}) as Record<string, boolean>;
      // Absent key ⇒ enabled. Explicit false ⇒ off.
      if (toggles[p.event_type] === false) return 0;

      let recipients = Array.from(new Set(p.recipients.filter((r): r is string => !!r)));
      if (recipients.length === 0) return 0;

      if (p.dedupe && p.entity) {
        const existing = await this.prisma.notification.findMany({
          where: {
            organization_id: p.orgId,
            user_id: { in: recipients },
            event_type: p.event_type,
            entity_id: p.entity.id,
          },
          select: { user_id: true },
        });
        const seen = new Set(existing.map((e) => e.user_id));
        recipients = recipients.filter((r) => !seen.has(r));
        if (recipients.length === 0) return 0;
      }

      const rows = await this.prisma.$transaction(
        recipients.map((userId) =>
          this.prisma.notification.create({
            data: {
              organization_id: p.orgId,
              user_id: userId,
              module: p.module,
              event_type: p.event_type,
              title: p.title,
              body: p.body,
              link: p.link ?? null,
              entity_type: p.entity?.type ?? null,
              entity_id: p.entity?.id ?? null,
            },
          }),
        ),
      );

      // Delivery is best-effort — must never throw into the business flow.
      for (const row of rows) {
        try {
          this.gateway.emitToUser(row.user_id, 'notification', row);
        } catch (err) {
          this.logger.warn(`Socket emit failed: ${err}`);
        }
        void this.push
          .sendToUser(p.orgId, row.user_id, { title: row.title, body: row.body, link: row.link })
          .catch((err) => this.logger.warn(`Push failed: ${err}`));
      }
      return rows.length;
    } catch (err) {
      // A notification failure must never break the originating action.
      this.logger.error(`emit(${p.event_type}) failed: ${err}`);
      return 0;
    }
  }

  /** Resolve a user's display name (for message bodies). */
  async userName(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    return u?.name ?? 'Someone';
  }

  // ─── List / read APIs ────────────────────────────────────────────────────────

  async list(orgId: string, userId: string, cursor?: string, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { organization_id: orgId, user_id: userId },
        orderBy: { created_at: 'desc' },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.notification.count({
        where: { organization_id: orgId, user_id: userId, is_read: false },
      }),
    ]);
    const hasMore = items.length > take;
    return {
      items: hasMore ? items.slice(0, take) : items,
      next_cursor: hasMore ? items[take - 1].id : null,
      unread_count: unread,
    };
  }

  async unreadCount(orgId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: { organization_id: orgId, user_id: userId, is_read: false },
    });
    return { unread_count: count };
  }

  async markRead(orgId: string, userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, organization_id: orgId, user_id: userId },
      data: { is_read: true },
    });
    return { ok: true };
  }

  async markAllRead(orgId: string, userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { organization_id: orgId, user_id: userId, is_read: false },
      data: { is_read: true },
    });
    return { ok: true, updated: res.count };
  }

  // ─── Push subscriptions ──────────────────────────────────────────────────────

  async subscribePush(
    orgId: string,
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string },
  ) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        organization_id: orgId,
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: sub.userAgent ?? null,
      },
      update: {
        organization_id: orgId,
        user_id: userId,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
    });
    return { ok: true };
  }

  async unsubscribePush(endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return { ok: true };
  }

  // ─── Overdue engine ─────────────────────────────────────────────────────────
  // task_overdue fires once when a task passes its deadline incomplete;
  // task_overdue_followup fires once more after `overdue_followup_days`.
  // Dedup via emit({ dedupe: true }) keeps replay/cron idempotent.

  @Cron(CronExpression.EVERY_HOUR)
  async processOverdueNotifications() {
    const now = new Date();
    const orgs = await this.prisma.organization.findMany({
      where: { is_test: false },
      select: { id: true },
    });
    for (const org of orgs) {
      await this.processOverdueNotificationsForOrg(org.id, now).catch((err) =>
        this.logger.error(`Overdue notifications failed for org ${org.id}: ${err}`),
      );
    }
  }

  async processOverdueNotificationsForOrg(orgId: string, now: Date): Promise<void> {
    const master = await this.getMaster(orgId);
    const followupMs = master.overdue_followup_days * 24 * 60 * 60 * 1000;

    const overdue = await this.prisma.task.findMany({
      where: {
        organization_id: orgId,
        is_deleted: false,
        deadline: { lt: now },
        status: { type: { notIn: TERMINAL_TYPES } },
      },
      select: {
        id: true,
        title: true,
        deadline: true,
        created_by_user_id: true,
        assignees: { where: { is_cc: false }, select: { user_id: true } },
      },
    });

    for (const t of overdue) {
      const recipients = [...t.assignees.map((a) => a.user_id), t.created_by_user_id];
      await this.emit({
        orgId,
        module: 'tasks',
        event_type: 'task_overdue',
        recipients,
        title: 'Task overdue',
        body: `"${t.title}" is past its deadline.`,
        link: `/dashboard/tasks/${t.id}`,
        entity: { type: 'task', id: t.id },
        dedupe: true,
      });

      if (t.deadline && now.getTime() - t.deadline.getTime() >= followupMs) {
        await this.emit({
          orgId,
          module: 'tasks',
          event_type: 'task_overdue_followup',
          recipients,
          title: 'Task still overdue',
          body: `"${t.title}" has been overdue for ${master.overdue_followup_days}+ days.`,
          link: `/dashboard/tasks/${t.id}`,
          entity: { type: 'task', id: t.id },
          dedupe: true,
        });
      }
    }
  }
}
