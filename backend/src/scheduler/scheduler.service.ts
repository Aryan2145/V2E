import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { HolidaysService } from '../holidays/holidays.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditWriterService } from '../audit/audit-writer.service';
import { shouldEntryFireToday } from '../common/recurrence/should-fire-today';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly holidaysService: HolidaysService,
    private readonly notifications: NotificationsService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  // ─── Recurring Task Spawn Engine ──────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async spawnRecurringTasks() {
    this.logger.log('Recurring spawn engine starting...');
    const now = new Date();

    // Real-time orgs only — test orgs are advanced by the ReplayService on their sim clock.
    const orgs = await this.prisma.organization.findMany({
      where: { is_test: false },
      select: { id: true },
    });

    let spawned = 0;
    for (const org of orgs) {
      const r = await this.spawnRecurringForOrg(org.id, now);
      spawned += r.spawned;
      await this.spawnDemandedLogsForOrg(org.id, now);
    }

    this.logger.log(`Recurring spawn: ${spawned} tasks spawned`);
  }

  // Org-scoped, now-injected spawn — used by the midnight cron (real now) and by
  // ReplayService (a simulated day instant) so both paths share identical logic.
  async spawnRecurringForOrg(orgId: string, now: Date): Promise<{ spawned: number }> {
    return this.auditWriter.runAsSystem(
      { orgId, triggerSource: 'recurring_spawn', occurredAt: now },
      () => this.spawnRecurringForOrgImpl(orgId, now),
    );
  }

  private async spawnRecurringForOrgImpl(orgId: string, now: Date): Promise<{ spawned: number }> {
    const entries = await this.prisma.recurringScheduleEntry.findMany({
      where: { is_active: true, organization_id: orgId, template: { is_active: true } },
      include: { template: true },
    });

    let spawned = 0;
    for (const entry of entries) {
      const did = await this.spawnEntry(entry, false, now);
      if (did) spawned++;
    }

    // Deactivate on_date entries whose end_date has passed (relative to `now`)
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    await this.prisma.recurringScheduleEntry.updateMany({
      where: { is_active: true, organization_id: orgId, end_condition: 'on_date', end_date: { lt: today } },
      data: { is_active: false },
    });

    return { spawned };
  }

  // Spawn today's task for a specific template (on-demand, e.g. after create/resume).
  // `now` is the org's effective clock (real, or simulated for test orgs).
  async spawnForTemplate(orgId: string, templateId: string, force = false, now: Date = new Date()): Promise<{ spawned: number }> {
    const entries = await this.prisma.recurringScheduleEntry.findMany({
      where: { is_active: true, recurring_template_id: templateId, organization_id: orgId, template: { is_active: true } },
      include: { template: true },
    });

    let spawned = 0;
    for (const entry of entries) {
      const did = await this.spawnEntry(entry, force, now);
      if (did) spawned++;
    }
    return { spawned };
  }

  private async spawnEntry(entry: any, force = false, now: Date = new Date()): Promise<boolean> {
    try {
      if (!shouldEntryFireToday(entry, now)) return false;

      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

      if (!force) {
        const alreadyToday = await this.prisma.task.count({
          where: {
            organization_id: entry.organization_id,
            recurring_template_id: entry.recurring_template_id,
            is_deleted: false,
            created_at: { gte: todayStart, lte: todayEnd },
          },
        });
        if (alreadyToday > 0) return false;
      }

      const template = entry.template;

      const status = await this.prisma.taskStatus.findFirst({
        where: { organization_id: template.organization_id, is_default: true, is_active: true },
        orderBy: { order_index: 'asc' },
      });
      if (!status) return false;

      const [h, m] = entry.time.split(':').map(Number);
      const rawDeadline = new Date(now);
      rawDeadline.setHours(h, m, 0, 0);

      const adjustedDeadline = await this.holidaysService.adjustDeadline(rawDeadline, template.organization_id);
      if (adjustedDeadline === null) {
        const newCount = entry.occurrence_count + 1;
        await this.prisma.recurringScheduleEntry.update({
          where: { id: entry.id },
          data: {
            occurrence_count: { increment: 1 },
            ...(entry.end_condition === 'after_n' && entry.end_after !== null && newCount >= entry.end_after && { is_active: false }),
          },
        });
        const holidayName = await this.holidaysService['getHolidayNameForDate'](rawDeadline, template.organization_id).catch(() => 'Holiday');
        this.logger.log(`Spawn skipped for entry ${entry.id} due to holiday: ${holidayName}`);
        return false;
      }

      const task = await this.prisma.task.create({
        data: {
          organization_id: template.organization_id,
          title: template.title,
          description: template.description ?? undefined,
          category_id: template.category_id ?? undefined,
          priority_id: template.priority_id ?? undefined,
          status_id: status.id,
          quadrant: template.quadrant,
          type: 'recurring',
          created_by_user_id: template.created_by_user_id,
          department_id: template.department_id ?? undefined,
          completion_mode: template.completion_mode,
          proof_required: template.proof_required,
          deadline: adjustedDeadline,
          recurring_template_id: template.id,
          created_at: now, // align instance date with the (possibly simulated) clock
        },
      });

      const assigneeIds = template.assignee_user_ids as string[];
      const ccIds = template.cc_user_ids as string[];

      if (assigneeIds.length > 0) {
        await this.prisma.taskAssignee.createMany({
          data: assigneeIds.map((uid) => ({ organization_id: template.organization_id, task_id: task.id, user_id: uid, is_cc: false })),
          skipDuplicates: true,
        });
      }
      if (ccIds.length > 0) {
        await this.prisma.taskAssignee.createMany({
          data: ccIds.map((uid) => ({ organization_id: template.organization_id, task_id: task.id, user_id: uid, is_cc: true })),
          skipDuplicates: true,
        });
      }

      const newCount = entry.occurrence_count + 1;
      await this.prisma.recurringScheduleEntry.update({
        where: { id: entry.id },
        data: {
          occurrence_count: { increment: 1 },
          ...(entry.end_condition === 'after_n' && entry.end_after !== null && newCount >= entry.end_after && { is_active: false }),
        },
      });

      const activeCount = await this.prisma.recurringScheduleEntry.count({
        where: { recurring_template_id: template.id, is_active: true },
      });
      if (activeCount === 0) {
        await this.prisma.recurringTemplate.update({ where: { id: template.id }, data: { is_active: false } });
      }

      const deadlineAdjusted = adjustedDeadline.getTime() !== rawDeadline.getTime();
      await this.prisma.taskActivityLog.create({
        data: {
          organization_id: template.organization_id,
          task_id: task.id,
          performed_by_user_id: 'system',
          action: 'created',
          metadata: {
            source: 'recurring_spawn',
            template_id: template.id,
            entry_id: entry.id,
            ...(deadlineAdjusted && { deadline_adjusted: true, original_deadline: rawDeadline.toISOString(), adjusted_deadline: adjustedDeadline.toISOString() }),
          } as never,
        },
      });

      await this.notifications.emit({
        orgId: template.organization_id,
        module: 'tasks',
        event_type: 'recurring_spawned',
        recipients: assigneeIds,
        title: 'Recurring task created',
        body: `Today's "${template.title}" is ready.`,
        link: `/dashboard/tasks/${task.id}`,
        entity: { type: 'task', id: task.id },
      });

      return true;
    } catch (err) {
      this.logger.error(`Failed to spawn from entry ${entry.id}: ${err}`);
      return false;
    }
  }

  // ─── Reminder Engine ──────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async processReminders() {
    const now = new Date();
    const orgs = await this.prisma.organization.findMany({
      where: { is_test: false },
      select: { id: true },
    });
    for (const org of orgs) await this.processRemindersForOrg(org.id, now);
  }

  // Org-scoped, now-injected — cron passes real now, ReplayService passes sim now.
  async processRemindersForOrg(orgId: string, now: Date): Promise<number> {
    return this.auditWriter.runAsSystem(
      { orgId, triggerSource: 'reminder', occurredAt: now },
      () => this.processRemindersForOrgImpl(orgId, now),
    );
  }

  private async processRemindersForOrgImpl(orgId: string, now: Date): Promise<number> {
    const dueReminders = await this.prisma.taskReminder.findMany({
      where: { organization_id: orgId, remind_at: { lte: now }, is_sent: false },
      take: 500,
    });
    if (dueReminders.length === 0) return 0;

    // Load the reminded tasks (title + assignees) for notification messages.
    const taskIds = Array.from(new Set(dueReminders.map((r) => r.task_id)));
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: {
        id: true,
        title: true,
        deadline: true,
        assignees: { where: { is_cc: false }, select: { user_id: true } },
      },
    });
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    this.logger.log(`Processing ${dueReminders.length} reminders for org ${orgId}...`);
    let sent = 0;
    for (const reminder of dueReminders) {
      try {
        await this.prisma.taskReminder.update({
          where: { id: reminder.id },
          data: { is_sent: true },
        });
        await this.prisma.taskActivityLog.create({
          data: {
            organization_id: reminder.organization_id,
            task_id: reminder.task_id,
            performed_by_user_id: 'system',
            action: 'reminder_sent',
            metadata: { reminder_id: reminder.id, type: reminder.type } as never,
          },
        });

        const task = taskMap.get(reminder.task_id);
        if (task) {
          const due = task.deadline
            ? ` (due ${task.deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`
            : '';
          await this.notifications.emit({
            orgId,
            module: 'tasks',
            event_type: 'task_reminder',
            recipients: task.assignees.map((a) => a.user_id),
            title: 'Task reminder',
            body: `Reminder: "${task.title}"${due}`,
            link: `/dashboard/tasks/${task.id}`,
            entity: { type: 'task', id: task.id },
          });
        }
        sent++;
      } catch (err) {
        this.logger.error(`Failed to process reminder ${reminder.id}: ${err}`);
      }
    }
    return sent;
  }

  // ─── Meeting Reminder Engine (15 minutes before a scheduled meeting) ───────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processMeetingReminders() {
    const now = new Date();
    const orgs = await this.prisma.organization.findMany({
      where: { is_test: false },
      select: { id: true },
    });
    for (const org of orgs) await this.processMeetingRemindersForOrg(org.id, now);
  }

  // Org-scoped, now-injected — cron passes real now, ReplayService passes sim now.
  async processMeetingRemindersForOrg(orgId: string, now: Date): Promise<number> {
    return this.auditWriter.runAsSystem(
      { orgId, triggerSource: 'meeting_reminder', occurredAt: now },
      () => this.processMeetingRemindersForOrgImpl(orgId, now),
    );
  }

  private async processMeetingRemindersForOrgImpl(orgId: string, now: Date): Promise<number> {
    const windowEnd = new Date(now.getTime() + 15 * 60_000);
    const due = await this.prisma.meeting.findMany({
      where: {
        organization_id: orgId,
        is_deleted: false,
        status: 'scheduled',
        reminder_sent: false,
        scheduled_start: { not: null, lte: windowEnd },
      },
      select: {
        id: true,
        title: true,
        scheduled_start: true,
        attendees: { where: { response: 'accepted' }, select: { user_id: true } },
      },
      take: 500,
    });
    if (due.length === 0) return 0;

    let sent = 0;
    for (const m of due) {
      try {
        await this.prisma.meeting.update({ where: { id: m.id }, data: { reminder_sent: true } });
        // Only actually notify if the meeting is still upcoming (skip long-past on a clock jump).
        if (m.scheduled_start && m.scheduled_start >= now && m.attendees.length) {
          await this.notifications.emit({
            orgId,
            module: 'meetings',
            event_type: 'meeting_reminder',
            recipients: m.attendees.map((a) => a.user_id),
            title: 'Meeting in 15 minutes',
            body: `"${m.title}" starts soon`,
            link: `/dashboard/governance/meetings/${m.id}`,
            entity: { type: 'meeting', id: m.id },
          });
        }
        sent++;
      } catch (err) {
        this.logger.error(`Failed to process meeting reminder ${m.id}: ${err}`);
      }
    }
    return sent;
  }

  // ─── Escalation Engine ────────────────────────────────────────────────────────

  @Cron('*/15 * * * *')
  async processEscalations() {
    const now = new Date();
    const orgs = await this.prisma.organization.findMany({
      where: { is_test: false },
      select: { id: true },
    });
    let escalated = 0;
    for (const org of orgs) escalated += await this.processEscalationsForOrg(org.id, now);
    if (escalated > 0) this.logger.log(`Escalation engine: ${escalated} escalated`);
  }

  // Org-scoped, now-injected — cron passes real now, ReplayService passes sim now.
  async processEscalationsForOrg(orgId: string, now: Date): Promise<number> {
    return this.auditWriter.runAsSystem(
      { orgId, triggerSource: 'escalation', occurredAt: now },
      () => this.processEscalationsForOrgImpl(orgId, now),
    );
  }

  private async processEscalationsForOrgImpl(orgId: string, now: Date): Promise<number> {
    const overdueTasks = await this.prisma.task.findMany({
      where: {
        organization_id: orgId,
        is_deleted: false,
        deadline: { lt: now },
        escalations: { some: { is_active: true } },
      },
      include: {
        status: { select: { type: true } },
        escalations: { where: { is_active: true }, orderBy: { level: 'asc' } },
        assignees: { where: { is_cc: false }, select: { user_id: true } },
      },
    });

    let escalated = 0;
    for (const task of overdueTasks) {
      if (task.status?.type === 'completed') continue;
      const untriggered = task.escalations.find((e) => e.escalated_at === null);
      if (!untriggered) continue;

      if (untriggered.level > 1) {
        const prev = task.escalations.find((e) => e.level === untriggered.level - 1);
        if (!prev?.escalated_at) continue;
        const hoursSincePrev = (now.getTime() - prev.escalated_at.getTime()) / 3_600_000;
        if (hoursSincePrev < 1) continue;
      }

      try {
        await this.prisma.taskEscalation.update({
          where: { id: untriggered.id },
          data: { escalated_at: now },
        });
        await this.prisma.taskActivityLog.create({
          data: {
            organization_id: task.organization_id,
            task_id: task.id,
            performed_by_user_id: 'system',
            action: 'escalated',
            metadata: { level: untriggered.level, escalated_to: untriggered.escalate_to_user_id } as never,
          },
        });
        await this.notifications.emit({
          orgId,
          module: 'tasks',
          event_type: 'task_escalated',
          recipients: [untriggered.escalate_to_user_id, ...task.assignees.map((a) => a.user_id)],
          title: `Task escalated (level ${untriggered.level})`,
          body: `"${task.title}" is overdue and has been escalated.`,
          link: `/dashboard/tasks/${task.id}`,
          entity: { type: 'task', id: task.id },
        });
        escalated++;
      } catch (err) {
        this.logger.error(`Failed to escalate task ${task.id}: ${err}`);
      }
    }
    return escalated;
  }

  // ─── Demanded Work Log Spawn Engine ───────────────────────────────────────────
  // Materializes WorkLogSubmission rows from recurring WorkLogDemandSchedule entries.
  // Daily-frequency demands fold into that day's Daily Update (no separate chase);
  // any other frequency stands alone with its own deadline + a notification.
  async spawnDemandedLogsForOrg(orgId: string, now: Date): Promise<{ spawned: number }> {
    return this.auditWriter.runAsSystem(
      { orgId, triggerSource: 'demand_spawn', occurredAt: now },
      () => this.spawnDemandedLogsForOrgImpl(orgId, now),
    );
  }

  private async spawnDemandedLogsForOrgImpl(orgId: string, now: Date): Promise<{ spawned: number }> {
    const entries = await this.prisma.workLogDemandSchedule.findMany({
      where: { is_active: true, organization_id: orgId, demand: { is_active: true } },
      include: { demand: true },
    });

    let spawned = 0;
    for (const entry of entries) {
      if (!shouldEntryFireToday(entry, now)) continue;

      const due = new Date(now);
      due.setHours(0, 0, 0, 0);
      const demand = entry.demand;

      try {
        // Dedupe per day via the (demand_id, due_date) unique constraint.
        const existing = await this.prisma.workLogSubmission.findUnique({
          where: { demand_id_due_date: { demand_id: demand.id, due_date: due } },
        });
        if (existing) continue;

        await this.prisma.workLogSubmission.create({
          data: {
            organization_id: orgId,
            demand_id: demand.id,
            writer_user_id: demand.assignee_user_id,
            due_date: due,
            period_label: formatPeriodLabel(entry.schedule_type, due),
            status: 'pending',
          },
        });

        const newCount = entry.occurrence_count + 1;
        await this.prisma.workLogDemandSchedule.update({
          where: { id: entry.id },
          data: {
            occurrence_count: { increment: 1 },
            ...(entry.end_condition === 'after_n' &&
              entry.end_after !== null &&
              newCount >= entry.end_after && { is_active: false }),
          },
        });

        const activeCount = await this.prisma.workLogDemandSchedule.count({
          where: { demand_id: demand.id, is_active: true },
        });
        if (activeCount === 0) {
          await this.prisma.workLogDemand.update({ where: { id: demand.id }, data: { is_active: false } });
        }

        // Daily demands fold into the Daily Update; others get their own due notification.
        if (entry.schedule_type !== 'daily') {
          await this.notifications.emit({
            orgId,
            module: 'work_logs',
            event_type: 'work_log_demand_due',
            recipients: [demand.assignee_user_id],
            title: 'A log is due',
            body: `"${demand.title}" is due (${formatPeriodLabel(entry.schedule_type, due)}).`,
            link: '/dashboard/governance/daily-update',
            entity: { type: 'work_log_demand', id: demand.id },
          });
        }
        spawned++;
      } catch (err) {
        this.logger.error(`Failed to spawn demanded log from entry ${entry.id}: ${err}`);
      }
    }

    // Deactivate on_date entries whose end_date has passed.
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    await this.prisma.workLogDemandSchedule.updateMany({
      where: { is_active: true, organization_id: orgId, end_condition: 'on_date', end_date: { lt: today } },
      data: { is_active: false },
    });

    return { spawned };
  }

  // ─── Auto-Overdue Detection ───────────────────────────────────────────────────
  // Task "overdue" is otherwise computed at read time and thus invisible to audit.
  // This sweep PERSISTS the transition (is_overdue false→true) so it flows through
  // the Prisma audit extension as a system entry (trigger 'auto_overdue'). Idempotent
  // via the is_overdue flag (mirrors Ticket.sla_breached); replays deterministically.

  @Cron(CronExpression.EVERY_HOUR)
  async detectTaskOverdue() {
    const now = new Date();
    const orgs = await this.prisma.organization.findMany({
      where: { is_test: false },
      select: { id: true },
    });
    let flagged = 0;
    for (const org of orgs) flagged += await this.detectTaskOverdueForOrg(org.id, now);
    if (flagged > 0) this.logger.log(`Auto-overdue: ${flagged} task(s) marked overdue`);
  }

  // Org-scoped, now-injected — cron passes real now, ReplayService passes sim now.
  async detectTaskOverdueForOrg(orgId: string, now: Date): Promise<number> {
    return this.auditWriter.runAsSystem(
      { orgId, triggerSource: 'auto_overdue', occurredAt: now },
      () => this.detectTaskOverdueForOrgImpl(orgId, now),
    );
  }

  private async detectTaskOverdueForOrgImpl(orgId: string, now: Date): Promise<number> {
    const tasks = await this.prisma.task.findMany({
      where: {
        organization_id: orgId,
        is_deleted: false,
        is_overdue: false,
        deadline: { lt: now },
        status: { type: { not: 'completed' } },
      },
      select: { id: true },
    });

    let flagged = 0;
    for (const task of tasks) {
      try {
        // Per-row update so the extension emits one audit entry per task.
        await this.prisma.task.update({
          where: { id: task.id },
          data: { is_overdue: true, overdue_at: now },
        });
        flagged++;
      } catch (err) {
        this.logger.error(`Failed to mark task ${task.id} overdue: ${err}`);
      }
    }
    return flagged;
  }
}

// Human label for a submission's period, derived from its frequency.
function formatPeriodLabel(scheduleType: string, due: Date): string {
  if (scheduleType === 'monthly') {
    return due.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  }
  if (scheduleType === 'yearly') {
    return String(due.getFullYear());
  }
  // daily / weekly → a specific day
  return due.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
