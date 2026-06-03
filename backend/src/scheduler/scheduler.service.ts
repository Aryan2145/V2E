import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { HolidaysService } from '../holidays/holidays.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly holidaysService: HolidaysService,
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
    }

    this.logger.log(`Recurring spawn: ${spawned} tasks spawned`);
  }

  // Org-scoped, now-injected spawn — used by the midnight cron (real now) and by
  // ReplayService (a simulated day instant) so both paths share identical logic.
  async spawnRecurringForOrg(orgId: string, now: Date): Promise<{ spawned: number }> {
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
      if (!this.shouldEntryFireToday(entry, now)) return false;

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
    const dueReminders = await this.prisma.taskReminder.findMany({
      where: { organization_id: orgId, remind_at: { lte: now }, is_sent: false },
      take: 500,
    });
    if (dueReminders.length === 0) return 0;

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
        sent++;
      } catch (err) {
        this.logger.error(`Failed to process reminder ${reminder.id}: ${err}`);
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
        escalated++;
      } catch (err) {
        this.logger.error(`Failed to escalate task ${task.id}: ${err}`);
      }
    }
    return escalated;
  }

  // ─── Schedule helper ──────────────────────────────────────────────────────────

  private shouldEntryFireToday(entry: {
    start_date: Date;
    schedule_type: string;
    every: number;
    days: unknown;
    month_days: unknown;
    yearly_dates: unknown;
    end_condition: string;
    end_date: Date | null;
    end_after: number | null;
    occurrence_count: number;
  }, now: Date = new Date()): boolean {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(entry.start_date);
    startDate.setHours(0, 0, 0, 0);

    if (today < startDate) return false;

    if (entry.end_condition === 'on_date' && entry.end_date) {
      const endDate = new Date(entry.end_date);
      endDate.setHours(0, 0, 0, 0);
      if (today > endDate) return false;
    }
    if (entry.end_condition === 'after_n' && entry.end_after !== null) {
      if (entry.occurrence_count >= entry.end_after) return false;
    }

    const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / 86_400_000);
    const todayDow = today.getDay();
    const todayDate = today.getDate();
    const todayMonth = today.getMonth() + 1;

    switch (entry.schedule_type) {
      case 'daily':
        return daysDiff % entry.every === 0;

      case 'weekly': {
        const weeksDiff = Math.floor(daysDiff / 7);
        if (weeksDiff % entry.every !== 0) return false;
        const days = entry.days as number[];
        return Array.isArray(days) && days.includes(todayDow);
      }

      case 'monthly': {
        const monthDays = entry.month_days as number[];
        if (!Array.isArray(monthDays) || !monthDays.includes(todayDate)) return false;
        const monthsDiff =
          (today.getFullYear() - startDate.getFullYear()) * 12 +
          (today.getMonth() - startDate.getMonth());
        return monthsDiff % entry.every === 0;
      }

      case 'yearly': {
        const yearlyDates = entry.yearly_dates as { month: number; day: number }[];
        if (!Array.isArray(yearlyDates)) return false;
        const matches = yearlyDates.some((d) => d.month === todayMonth && d.day === todayDate);
        if (!matches) return false;
        const yearsDiff = today.getFullYear() - startDate.getFullYear();
        return yearsDiff % entry.every === 0;
      }

      default:
        return false;
    }
  }
}
