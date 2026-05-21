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

    const entries = await this.prisma.recurringScheduleEntry.findMany({
      where: { is_active: true, template: { is_active: true } },
      include: { template: true },
    });

    let spawned = 0;

    for (const entry of entries) {
      try {
        if (!this.shouldEntryFireToday(entry)) continue;

        // Dedup: one task per entry per day
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const already = await this.prisma.task.count({
          where: {
            organization_id: entry.organization_id,
            recurring_template_id: entry.recurring_template_id,
            created_at: { gte: todayStart, lte: todayEnd },
            // Each entry stores its id in activity log metadata; use a simpler
            // approach: allow one task per template per entry time slot
          },
        });

        // If another entry for the same template already spawned today and
        // produced a task, we still allow this entry to spawn (multi-entry).
        // Use entry.id stored in activity logs for precise dedup.
        const alreadyThisEntry = await this.prisma.taskActivityLog.count({
          where: {
            organization_id: entry.organization_id,
            performed_by_user_id: 'system',
            action: 'created',
            created_at: { gte: todayStart, lte: todayEnd },
            metadata: { path: ['entry_id'], equals: entry.id },
          },
        });
        if (alreadyThisEntry > 0) continue;

        const template = entry.template;

        const status = await this.prisma.taskStatus.findFirst({
          where: { organization_id: template.organization_id, is_default: true, is_active: true },
          orderBy: { order_index: 'asc' },
        });
        if (!status) continue;

        const [h, m] = entry.time.split(':').map(Number);
        const rawDeadline = new Date();
        rawDeadline.setHours(h, m, 0, 0);

        // Holiday adjustment
        const adjustedDeadline = await this.holidaysService.adjustDeadline(
          rawDeadline, template.organization_id,
        );
        if (adjustedDeadline === null) {
          // skip_create: org explicitly wants to skip this occurrence
          const newCount = entry.occurrence_count + 1;
          await this.prisma.recurringScheduleEntry.update({
            where: { id: entry.id },
            data: {
              occurrence_count: { increment: 1 },
              ...(entry.end_condition === 'after_n' &&
                entry.end_after !== null &&
                newCount >= entry.end_after && { is_active: false }),
            },
          });
          // Log skip in a placeholder activity log (no task_id — log against template via metadata)
          // We create a dummy task reference log using template_id as entity context
          const holidayName = await this.holidaysService['getHolidayNameForDate'](rawDeadline, template.organization_id).catch(() => 'Holiday');
          this.logger.log(`Recurring spawn skipped for entry ${entry.id} on ${rawDeadline.toISOString().slice(0, 10)} due to holiday: ${holidayName}`);
          continue;
        }
        const deadline = adjustedDeadline;

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
            deadline,
            recurring_template_id: template.id,
          },
        });

        const assigneeIds = template.assignee_user_ids as string[];
        const ccIds = template.cc_user_ids as string[];

        if (assigneeIds.length > 0) {
          await this.prisma.taskAssignee.createMany({
            data: assigneeIds.map((uid) => ({
              organization_id: template.organization_id,
              task_id: task.id,
              user_id: uid,
              is_cc: false,
            })),
            skipDuplicates: true,
          });
        }
        if (ccIds.length > 0) {
          await this.prisma.taskAssignee.createMany({
            data: ccIds.map((uid) => ({
              organization_id: template.organization_id,
              task_id: task.id,
              user_id: uid,
              is_cc: true,
            })),
            skipDuplicates: true,
          });
        }

        // Increment entry occurrence count
        const newCount = entry.occurrence_count + 1;
        await this.prisma.recurringScheduleEntry.update({
          where: { id: entry.id },
          data: {
            occurrence_count: { increment: 1 },
            ...(entry.end_condition === 'after_n' &&
              entry.end_after !== null &&
              newCount >= entry.end_after && { is_active: false }),
          },
        });

        // Check if all entries for this template are now inactive
        const activeCount = await this.prisma.recurringScheduleEntry.count({
          where: { recurring_template_id: template.id, is_active: true },
        });
        if (activeCount === 0) {
          await this.prisma.recurringTemplate.update({
            where: { id: template.id },
            data: { is_active: false },
          });
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
              ...(deadlineAdjusted && {
                deadline_adjusted: true,
                original_deadline: rawDeadline.toISOString(),
                adjusted_deadline: adjustedDeadline.toISOString(),
              }),
            } as never,
          },
        });

        spawned++;
      } catch (err) {
        this.logger.error(`Failed to spawn from entry ${entry.id}: ${err}`);
      }
    }

    // Deactivate on_date entries whose end_date has passed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.prisma.recurringScheduleEntry.updateMany({
      where: { is_active: true, end_condition: 'on_date', end_date: { lt: today } },
      data: { is_active: false },
    });

    this.logger.log(`Recurring spawn: ${spawned} tasks spawned`);
  }

  // ─── Reminder Engine ──────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async processReminders() {
    const now = new Date();
    const dueReminders = await this.prisma.taskReminder.findMany({
      where: { remind_at: { lte: now }, is_sent: false },
      take: 500,
    });
    if (dueReminders.length === 0) return;

    this.logger.log(`Processing ${dueReminders.length} reminders...`);
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
      } catch (err) {
        this.logger.error(`Failed to process reminder ${reminder.id}: ${err}`);
      }
    }
  }

  // ─── Escalation Engine ────────────────────────────────────────────────────────

  @Cron('*/15 * * * *')
  async processEscalations() {
    const now = new Date();
    const overdueTasks = await this.prisma.task.findMany({
      where: {
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
    if (escalated > 0) this.logger.log(`Escalation engine: ${escalated} escalated`);
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
  }): boolean {
    const today = new Date();
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
