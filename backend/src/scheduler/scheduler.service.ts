import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Recurring Task Spawn Engine ──────────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async spawnRecurringTasks() {
    this.logger.log('Recurring spawn engine starting...');
    const templates = await this.prisma.recurringTemplate.findMany({
      where: { is_active: true },
    });

    let spawned = 0;
    for (const template of templates) {
      try {
        if (!this.shouldSpawnToday(template as any)) continue;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const already = await this.prisma.task.count({
          where: {
            organization_id: template.organization_id,
            recurring_template_id: template.id,
            created_at: { gte: todayStart, lte: todayEnd },
          },
        });
        if (already > 0) continue;

        const status = await this.prisma.taskStatus.findFirst({
          where: { organization_id: template.organization_id, is_default: true, is_active: true },
          orderBy: { order_index: 'asc' },
        });
        if (!status) continue;

        const [h, m] = (template.time ?? '09:00').split(':').map(Number);
        const deadline = new Date();
        deadline.setHours(h, m, 0, 0);

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

        await this.prisma.recurringTemplate.update({
          where: { id: template.id },
          data: { occurrence_count: { increment: 1 } },
        });

        await this.prisma.taskActivityLog.create({
          data: {
            organization_id: template.organization_id,
            task_id: task.id,
            performed_by_user_id: 'system',
            action: 'created',
            metadata: { source: 'recurring_spawn', template_id: template.id } as any,
          },
        });

        spawned++;
      } catch (err) {
        this.logger.error(`Failed to spawn from template ${template.id}: ${err}`);
      }
    }
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
            metadata: { reminder_id: reminder.id, type: reminder.type } as any,
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
        escalations: {
          where: { is_active: true },
          orderBy: { level: 'asc' },
        },
      },
    });

    let escalated = 0;
    for (const task of overdueTasks) {
      if (task.status?.type === 'completed') continue;

      const escalations = task.escalations;
      const untriggered = escalations.find((e) => e.escalated_at === null);
      if (!untriggered) continue;

      if (untriggered.level > 1) {
        const prev = escalations.find((e) => e.level === untriggered.level - 1);
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
            metadata: {
              level: untriggered.level,
              escalated_to: untriggered.escalate_to_user_id,
            } as any,
          },
        });
        escalated++;
      } catch (err) {
        this.logger.error(`Failed to escalate task ${task.id}: ${err}`);
      }
    }
    if (escalated > 0) this.logger.log(`Escalation engine: ${escalated} escalated`);
  }

  // ─── Schedule helpers ─────────────────────────────────────────────────────────

  private shouldSpawnToday(template: {
    start_date: Date;
    schedule_type: string;
    every: number;
    days: unknown;
    month_day: number | null;
    month: number | null;
    end_condition: string;
    end_date: Date | null;
    end_after: number | null;
    occurrence_count: number;
  }): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(template.start_date);
    startDate.setHours(0, 0, 0, 0);

    if (today < startDate) return false;

    if (template.end_condition === 'on_date' && template.end_date) {
      const endDate = new Date(template.end_date);
      endDate.setHours(0, 0, 0, 0);
      if (today > endDate) return false;
    }
    if (template.end_condition === 'after_n' && template.end_after !== null) {
      if (template.occurrence_count >= template.end_after) return false;
    }

    const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / 86_400_000);
    const todayDow = today.getDay();
    const todayDate = today.getDate();
    const todayMonth = today.getMonth() + 1;

    switch (template.schedule_type) {
      case 'daily':
        return daysDiff % template.every === 0;

      case 'weekly': {
        const weeksDiff = Math.floor(daysDiff / 7);
        if (weeksDiff % template.every !== 0) return false;
        const days = template.days as number[];
        return Array.isArray(days) && days.includes(todayDow);
      }

      case 'monthly': {
        if (template.month_day !== todayDate) return false;
        const monthsDiff =
          (today.getFullYear() - startDate.getFullYear()) * 12 +
          (today.getMonth() - startDate.getMonth());
        return monthsDiff % template.every === 0;
      }

      case 'yearly': {
        if (template.month_day !== todayDate) return false;
        if (template.month !== null && template.month !== todayMonth) return false;
        const yearsDiff = today.getFullYear() - startDate.getFullYear();
        return yearsDiff % template.every === 0;
      }

      default:
        return false;
    }
  }
}
