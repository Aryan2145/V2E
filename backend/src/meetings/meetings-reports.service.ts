import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { Actor } from './meetings.service';

const MIN = 60_000;
const HOUR = 60 * MIN;
const ON_TIME_GRACE_MS = 5 * MIN;

@Injectable()
export class MeetingsReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  // ─── Level 1 — per-meeting analytics ───────────────────────────────────────────
  async analytics(orgId: string, id: string) {
    const m = await this.prisma.meeting.findFirst({
      where: { id, organization_id: orgId, is_deleted: false },
      include: { attendees: true, action_items: true, decisions: true },
    });
    if (!m) throw new NotFoundException('Meeting not found');

    const plannedMs = m.scheduled_start && m.scheduled_end ? m.scheduled_end.getTime() - m.scheduled_start.getTime() : null;
    const actualMs = m.actual_start && m.actual_end ? m.actual_end.getTime() - m.actual_start.getTime() : null;

    const invited = m.attendees.filter((a) => !a.is_organizer);
    const accepted = invited.filter((a) => a.response === 'accepted');
    const attended = m.attendees.filter((a) => a.attended);
    const late = m.attendees.filter((a) => a.attended && a.attended_in_at && m.scheduled_start && a.attended_in_at > m.scheduled_start);
    const noShow = accepted.filter((a) => !a.attended);

    const linkedTaskIds = m.action_items.map((a) => a.linked_task_id).filter(Boolean) as string[];
    const completedMap = await this.tasks.areCompleted(orgId, linkedTaskIds);
    const doneCount = m.action_items.filter((a) => a.is_done || (a.linked_task_id && completedMap[a.linked_task_id])).length;

    return {
      planned_minutes: plannedMs != null ? Math.round(plannedMs / MIN) : null,
      actual_minutes: actualMs != null ? Math.round(actualMs / MIN) : null,
      overrun_minutes: plannedMs != null && actualMs != null ? Math.round((actualMs - plannedMs) / MIN) : null,
      attendance: {
        invited: invited.length,
        accepted: accepted.length,
        attended: attended.length,
        late: late.length,
        no_show: noShow.length,
      },
      action_items: {
        created: m.action_items.length,
        linked: linkedTaskIds.length,
        done: doneCount,
      },
      decisions: m.decisions.length,
      linkage: m.link_type ?? 'ad_hoc',
      started_on_time:
        m.actual_start && m.scheduled_start
          ? m.actual_start.getTime() <= m.scheduled_start.getTime() + ON_TIME_GRACE_MS
          : null,
    };
  }

  // ─── Level 2 — aggregated reports (viewer-scoped) ──────────────────────────────
  async report(orgId: string, actor: Actor, filters: Record<string, string | undefined>) {
    const where = await this.buildScopedWhere(orgId, actor, filters);

    const meetings = await this.prisma.meeting.findMany({
      where,
      include: {
        attendees: { select: { user_id: true, is_organizer: true, response: true, attended: true, attended_in_at: true } },
        action_items: { select: { linked_task_id: true, is_done: true } },
        decisions: { select: { id: true } },
      },
    });

    const count = meetings.length;
    let totalMs = 0;
    let overrunSum = 0;
    let overrunN = 0;
    let onTime = 0;
    let onTimeN = 0;
    let invitedTotal = 0;
    let acceptedTotal = 0;
    let attendedTotal = 0;
    let noShowTotal = 0;
    let decisionsTotal = 0;
    let zeroDecisionMeetings = 0;
    let actionItemsTotal = 0;
    let linkedTotal = 0;
    const linkedTaskIds: string[] = [];
    const loadPerPerson = new Map<string, number>();
    const byLinkage = new Map<string, number>(); // hours by link type
    const goalAttention = new Map<string, { meetings: number; hours: number }>();

    for (const m of meetings) {
      const plannedMs = m.scheduled_start && m.scheduled_end ? m.scheduled_end.getTime() - m.scheduled_start.getTime() : 0;
      const actualMs = m.actual_start && m.actual_end ? m.actual_end.getTime() - m.actual_start.getTime() : 0;
      const durMs = actualMs || plannedMs;
      totalMs += durMs;
      if (plannedMs && actualMs) { overrunSum += actualMs - plannedMs; overrunN++; }
      if (m.actual_start && m.scheduled_start) {
        onTimeN++;
        if (m.actual_start.getTime() <= m.scheduled_start.getTime() + ON_TIME_GRACE_MS) onTime++;
      }
      const invited = m.attendees.filter((a) => !a.is_organizer);
      const accepted = invited.filter((a) => a.response === 'accepted');
      invitedTotal += invited.length;
      acceptedTotal += accepted.length;
      attendedTotal += m.attendees.filter((a) => a.attended).length;
      noShowTotal += accepted.filter((a) => !a.attended).length;
      for (const a of m.attendees) loadPerPerson.set(a.user_id, (loadPerPerson.get(a.user_id) ?? 0) + 1);

      decisionsTotal += m.decisions.length;
      if (m.decisions.length === 0) zeroDecisionMeetings++;
      actionItemsTotal += m.action_items.length;
      for (const ai of m.action_items) if (ai.linked_task_id) { linkedTotal++; linkedTaskIds.push(ai.linked_task_id); }

      const linkKey = m.link_type ?? 'ad_hoc';
      byLinkage.set(linkKey, (byLinkage.get(linkKey) ?? 0) + durMs / HOUR);
      if (m.link_type === 'goal' && m.link_entity_id) {
        const g = goalAttention.get(m.link_entity_id) ?? { meetings: 0, hours: 0 };
        g.meetings++; g.hours += durMs / HOUR;
        goalAttention.set(m.link_entity_id, g);
      }
    }

    const completedMap = await this.tasks.areCompleted(orgId, linkedTaskIds);
    const linkedCompleted = linkedTaskIds.filter((tid) => completedMap[tid]).length;

    return {
      activity: {
        meetings_count: count,
        total_hours: round(totalMs / HOUR),
        avg_duration_min: count ? Math.round(totalMs / MIN / count) : 0,
        avg_overrun_min: overrunN ? Math.round(overrunSum / MIN / overrunN) : 0,
        load_per_person: [...loadPerPerson.entries()]
          .map(([user_id, meetings]) => ({ user_id, meetings }))
          .sort((a, b) => b.meetings - a.meetings),
      },
      attendance: {
        attendance_rate: invitedTotal ? round((attendedTotal / invitedTotal) * 100) : 0,
        no_show_rate: acceptedTotal ? round((noShowTotal / acceptedTotal) * 100) : 0,
        started_on_time_rate: onTimeN ? round((onTime / onTimeN) * 100) : 0,
      },
      output: {
        decisions_total: decisionsTotal,
        decisions_per_meeting: count ? round(decisionsTotal / count) : 0,
        zero_decision_meetings: zeroDecisionMeetings,
        action_items_created: actionItemsTotal,
        pct_linked_to_tasks: actionItemsTotal ? round((linkedTotal / actionItemsTotal) * 100) : 0,
        pct_linked_tasks_completed: linkedTotal ? round((linkedCompleted / linkedTotal) * 100) : 0,
      },
      linkage: {
        hours_by_type: [...byLinkage.entries()].map(([type, hours]) => ({ type, hours: round(hours) })),
        goal_attention: [...goalAttention.entries()]
          .map(([goal_id, v]) => ({ goal_id, meetings: v.meetings, hours: round(v.hours) }))
          .sort((a, b) => b.hours - a.hours),
      },
    };
  }

  // Build the org/date/scope/filter where-clause for reports.
  private async buildScopedWhere(orgId: string, actor: Actor, filters: Record<string, string | undefined>) {
    const where: Prisma.MeetingWhereInput = { organization_id: orgId, is_deleted: false };
    if (filters.from_date || filters.to_date) {
      where.scheduled_start = {};
      if (filters.from_date) (where.scheduled_start as any).gte = new Date(filters.from_date);
      if (filters.to_date) (where.scheduled_start as any).lte = new Date(filters.to_date);
    }

    const adminAll = actor.isSuperAdmin || actor.role === 'org_admin';
    const organizerScope: string[] | null = adminAll ? null : await this.scopeUserIds(orgId, actor);
    if (organizerScope && organizerScope.length === 0) {
      // not a head and no scope → only meetings they take part in
      where.attendees = { some: { user_id: actor.id } };
    } else if (organizerScope) {
      where.created_by_user_id = { in: organizerScope };
    }

    // explicit filters narrow further
    if (filters.user) {
      where.OR = [{ created_by_user_id: filters.user }, { attendees: { some: { user_id: filters.user } } }];
    }
    if (filters.department) {
      const ids = await this.userIdsInDepartments(orgId, [filters.department]);
      where.created_by_user_id = { in: ids.length ? ids : ['__none__'] };
    }
    if (filters.role) {
      const ids = await this.userIdsWithRole(orgId, filters.role);
      where.created_by_user_id = { in: ids.length ? ids : ['__none__'] };
    }
    return where;
  }

  /** For a department head: organizer user-ids in their departments (else []). */
  private async scopeUserIds(orgId: string, actor: Actor): Promise<string[]> {
    const headed = await this.prisma.department.findMany({
      where: { organization_id: orgId, head_user_id: actor.id },
      select: { id: true },
    });
    if (!headed.length) return [];
    const ids = await this.userIdsInDepartments(orgId, headed.map((d) => d.id));
    return [...new Set(ids.concat(actor.id))];
  }

  private async userIdsInDepartments(orgId: string, deptIds: string[]): Promise<string[]> {
    const profiles = await this.prisma.employeeProfile.findMany({
      where: { organization_id: orgId, department_id: { in: deptIds } },
      select: { user_id: true },
    });
    return profiles.map((p) => p.user_id);
  }

  private async userIdsWithRole(orgId: string, role: string): Promise<string[]> {
    const members = await this.prisma.organizationMember.findMany({
      where: { organization_id: orgId, role: role as any },
      select: { user_id: true },
    });
    return members.map((m) => m.user_id);
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
