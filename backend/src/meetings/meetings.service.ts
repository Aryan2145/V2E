import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClockService } from '../clock/clock.service';
import { TasksService } from '../tasks/tasks.service';
import { PermissionsService, principalFromUser } from '../access-rights/permissions.service';
import { SubjectEligibilityService } from '../access-rights/subject-eligibility.service';
import { ScopeService } from '../access-rights/scope.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import {
  UpdateMeetingDto,
  UpdateRecordDto,
  RespondDto,
  AddSlotDto,
  VoteSlotDto,
  ConfirmSlotDto,
  MarkAttendanceDto,
  PrivateNoteDto,
} from './dto/meeting-actions.dto';
import {
  CreateActionItemDto,
  UpdateActionItemDto,
  LinkTaskDto,
  CreateDecisionDto,
  UpdateDecisionDto,
} from './dto/outputs.dto';

export interface Actor {
  id: string;
  system_role_id: string | null;
  is_admin: boolean;
  isSuperAdmin: boolean;
}

const RESCHEDULE_THRESHOLD = 2; // reschedule requests before offering the poll hatch
const MEETING = 'meetings';
const LINK = '/dashboard/governance/meetings';

const DETAIL_INCLUDE = {
  organizer: { select: { id: true, name: true, email: true } },
  attendees: { include: { user: { select: { id: true, name: true, email: true } } } },
  slots: { include: { votes: true }, orderBy: { start_at: 'asc' } },
  action_items: { orderBy: { created_at: 'asc' } },
  decisions: { orderBy: { decided_on: 'desc' } },
} satisfies Prisma.MeetingInclude;

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly clock: ClockService,
    private readonly tasks: TasksService,
    private readonly permissions: PermissionsService,
    private readonly subjects: SubjectEligibilityService,
    private readonly scope: ScopeService,
  ) {
    this.scope.registerWiredList(MEETING);
  }

  // ─── Create ─────────────────────────────────────────────────────────────────
  async create(orgId: string, actor: Actor, dto: CreateMeetingDto) {
    if ((dto.location === undefined || dto.location === '') && dto.type !== 'online') {
      // offline/hybrid should have a location, but keep it soft (free text, optional)
    }
    const attendeeIds = [...new Set((dto.attendee_user_ids ?? []).filter((id) => id !== actor.id))];
    // Subject eligibility (fail loud): everyone invited must be allowed to be a meeting subject.
    await this.subjects.assertAllEligible(orgId, 'meetings.subject.invitable', attendeeIds);

    const data: Prisma.MeetingCreateInput = {
      organization_id: orgId,
      title: dto.title.trim(),
      type: dto.type,
      online_link: dto.online_link ?? null,
      online_password: dto.online_password ?? null,
      location: dto.location ?? null,
      mode: dto.mode,
      link_type: dto.link_type ?? null,
      link_entity_id: dto.link_type ? dto.link_entity_id ?? null : null,
      agenda: dto.agenda ?? null,
      organizer: { connect: { id: actor.id } },
      status: 'scheduled',
    };

    let notify: { event: string; title: string; body: string } | null = null;

    if (dto.log_past) {
      if (!dto.actual_start) throw new BadRequestException('A logged past meeting needs an actual start time.');
      data.actual_start = new Date(dto.actual_start);
      data.actual_end = dto.actual_end ? new Date(dto.actual_end) : null;
      data.scheduled_start = dto.scheduled_start ? new Date(dto.scheduled_start) : new Date(dto.actual_start);
      data.scheduled_end = dto.scheduled_end ? new Date(dto.scheduled_end) : data.actual_end ?? null;
      // A meeting that already happened lands as the closed, official record.
      // Use Reopen to amend it later.
      data.status = 'closed';
      if (dto.minutes !== undefined) data.minutes = dto.minutes;
    } else if (dto.mode === 'fixed') {
      if (!dto.scheduled_start || !dto.scheduled_end) {
        throw new BadRequestException('A fixed meeting needs a start and end time.');
      }
      data.scheduled_start = new Date(dto.scheduled_start);
      data.scheduled_end = new Date(dto.scheduled_end);
      data.status = 'scheduled';
      notify = {
        event: 'meeting_invited',
        title: "You're invited to a meeting",
        body: `${await this.notifications.userName(actor.id)} invited you to "${dto.title}"`,
      };
    } else {
      // poll
      if (!dto.poll_window_start || !dto.poll_window_end || !dto.poll_duration_min) {
        throw new BadRequestException('A poll needs a window (start, end) and a duration.');
      }
      data.poll_window_start = new Date(dto.poll_window_start);
      data.poll_window_end = new Date(dto.poll_window_end);
      data.poll_duration_min = dto.poll_duration_min;
      data.status = 'polling';
      notify = {
        event: 'meeting_poll_opened',
        title: 'Help schedule a meeting',
        body: `${await this.notifications.userName(actor.id)} opened a time poll for "${dto.title}"`,
      };
    }

    const meeting = await this.prisma.meeting.create({ data });

    // Organizer + invited attendees
    await this.prisma.meetingAttendee.create({
      data: {
        organization_id: orgId,
        meeting_id: meeting.id,
        user_id: actor.id,
        is_organizer: true,
        response: 'accepted',
        attended: !!dto.log_past,
      },
    });
    if (attendeeIds.length) {
      await this.prisma.meetingAttendee.createMany({
        data: attendeeIds.map((uid) => ({
          organization_id: orgId,
          meeting_id: meeting.id,
          user_id: uid,
          response: dto.log_past ? ('accepted' as const) : ('pending' as const),
          attended: !!dto.log_past,
        })),
        skipDuplicates: true,
      });
    }

    // Caller-provided poll slots + system-suggested slots
    if (dto.mode === 'poll' && !dto.log_past) {
      if (dto.slots?.length) {
        await this.prisma.meetingSlot.createMany({
          data: dto.slots.map((s) => ({
            organization_id: orgId,
            meeting_id: meeting.id,
            start_at: new Date(s.start_at),
            end_at: new Date(s.end_at),
            source: 'caller' as const,
            proposed_by_user_id: actor.id,
          })),
        });
      }
      await this.generateSystemSlots(orgId, meeting.id, attendeeIds.concat(actor.id), {
        windowStart: new Date(dto.poll_window_start!),
        windowEnd: new Date(dto.poll_window_end!),
        durationMin: dto.poll_duration_min!,
      });
    }

    await this.audit.record({
      orgId,
      actorId: actor.id,
      action: 'create',
      resource: 'meeting',
      entityId: meeting.id,
      entityLabel: meeting.title,
      changes: { status: { before: null, after: meeting.status } },
    });

    if (notify && attendeeIds.length) {
      await this.notifications.emit({
        orgId,
        module: 'meetings',
        event_type: notify.event,
        recipients: attendeeIds,
        title: notify.title,
        body: notify.body,
        link: `${LINK}/${meeting.id}`,
        entity: { type: 'meeting', id: meeting.id },
      });
    }

    return this.getOne(orgId, actor, meeting.id);
  }

  // ─── List + detail ────────────────────────────────────────────────────────────
  async list(orgId: string, actor: Actor, filters: Record<string, string | undefined>) {
    const where: Prisma.MeetingWhereInput = { organization_id: orgId, is_deleted: false };
    const scopeWhere = await this.scope.listWhere(orgId, principalFromUser(actor), MEETING);
    if (Object.keys(scopeWhere).length) where.AND = [scopeWhere as Prisma.MeetingWhereInput];
    if (filters.status) where.status = filters.status as any;
    if (filters.type) where.type = filters.type as any;
    if (filters.mode) where.mode = filters.mode as any;
    if (filters.link_type) where.link_type = filters.link_type as any;
    if (filters.mine === 'true') {
      where.attendees = { some: { user_id: actor.id } };
    } else if (filters.attendee) {
      where.attendees = { some: { user_id: filters.attendee } };
    }
    if (filters.from_date || filters.to_date) {
      where.scheduled_start = {};
      if (filters.from_date) (where.scheduled_start as any).gte = new Date(filters.from_date);
      if (filters.to_date) (where.scheduled_start as any).lte = new Date(filters.to_date);
    }
    if (filters.search) where.title = { contains: filters.search, mode: 'insensitive' };

    return this.prisma.meeting.findMany({
      where,
      orderBy: [{ scheduled_start: 'asc' }, { created_at: 'desc' }],
      include: {
        organizer: { select: { id: true, name: true } },
        _count: { select: { attendees: true, action_items: true, decisions: true } },
      },
    });
  }

  async getOne(orgId: string, actor: Actor, id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, organization_id: orgId, is_deleted: false },
      include: DETAIL_INCLUDE,
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const myNote = await this.prisma.meetingPrivateNote.findUnique({
      where: { meeting_id_user_id: { meeting_id: id, user_id: actor.id } },
    });

    const rescheduleCount = meeting.attendees.filter(
      (a) => a.response === 'reschedule_requested',
    ).length;

    // Conflict signal for the current schedule (accepted attendees double-booked)
    let conflicts: any[] = [];
    if (meeting.scheduled_start && meeting.scheduled_end) {
      conflicts = await this.conflictsFor(
        orgId,
        meeting.attendees.filter((a) => a.response === 'accepted').map((a) => a.user_id),
        meeting.scheduled_start,
        meeting.scheduled_end,
        meeting.id,
      );
    }

    return {
      ...meeting,
      my_note: myNote?.body ?? '',
      can_convert_to_poll: meeting.mode === 'fixed' && meeting.status === 'scheduled' && rescheduleCount >= RESCHEDULE_THRESHOLD,
      conflicts,
      can_manage: await this.canManage(orgId, meeting.created_by_user_id, actor),
    };
  }

  // ─── Header edit / delete ─────────────────────────────────────────────────────
  async update(orgId: string, actor: Actor, id: string, dto: UpdateMeetingDto) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireManage(orgId, meeting, actor);
    this.assertOpen(meeting);

    const data: Prisma.MeetingUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.online_link !== undefined) data.online_link = dto.online_link;
    if (dto.online_password !== undefined) data.online_password = dto.online_password;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.link_type !== undefined) data.link_type = dto.link_type;
    if (dto.link_entity_id !== undefined) data.link_entity_id = dto.link_entity_id;
    if (dto.scheduled_start !== undefined) data.scheduled_start = new Date(dto.scheduled_start);
    if (dto.scheduled_end !== undefined) data.scheduled_end = new Date(dto.scheduled_end);

    const updated = await this.prisma.meeting.update({ where: { id }, data });

    if (dto.attendee_user_ids) await this.syncAttendees(orgId, id, dto.attendee_user_ids, meeting.created_by_user_id);

    const changes = this.audit.diff(
      meeting,
      {
        title: dto.title?.trim(),
        type: dto.type,
        location: dto.location,
        scheduled_start: data.scheduled_start as Date | undefined,
        scheduled_end: data.scheduled_end as Date | undefined,
      } as any,
      ['title', 'type', 'location', 'scheduled_start', 'scheduled_end'],
    );
    if (changes) {
      await this.audit.record({
        orgId, actorId: actor.id, action: 'update', resource: 'meeting',
        entityId: id, entityLabel: updated.title, changes,
      });
    }
    return this.getOne(orgId, actor, id);
  }

  async remove(orgId: string, actor: Actor, id: string, reason?: string) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireManage(orgId, meeting, actor);
    await this.prisma.meeting.update({
      where: { id },
      data: { is_deleted: true, deleted_at: new Date(), deleted_by_user_id: actor.id, deletion_reason: reason ?? null },
    });
    await this.audit.record({
      orgId, actorId: actor.id, action: 'delete', resource: 'meeting',
      entityId: id, entityLabel: meeting.title,
      changes: reason ? { deletion_reason: { before: null, after: reason } } : null,
    });
    return { success: true };
  }

  // ─── Shared record (agenda + minutes) — any attendee, while open ───────────────
  async updateRecord(orgId: string, actor: Actor, id: string, dto: UpdateRecordDto) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireAttendee(orgId, meeting, actor);
    this.assertOpen(meeting);
    const data: Prisma.MeetingUpdateInput = {};
    if (dto.agenda !== undefined) data.agenda = dto.agenda;
    if (dto.minutes !== undefined) data.minutes = dto.minutes;
    const updated = await this.prisma.meeting.update({ where: { id }, data });
    const changes = this.audit.diff(meeting, dto as any, ['agenda', 'minutes']);
    if (changes) {
      await this.audit.record({
        orgId, actorId: actor.id, action: 'update', resource: 'meeting',
        entityId: id, entityLabel: updated.title, changes,
      });
    }
    return this.getOne(orgId, actor, id);
  }

  // ─── Fixed-mode response ───────────────────────────────────────────────────────
  async respond(orgId: string, actor: Actor, id: string, dto: RespondDto) {
    const meeting = await this.findOrFail(orgId, id);
    const attendee = await this.getAttendeeOrFail(id, actor.id);
    if (meeting.mode !== 'fixed' || meeting.status !== 'scheduled') {
      throw new BadRequestException('You can only respond to a scheduled, fixed-time meeting.');
    }

    const data: Prisma.MeetingAttendeeUpdateInput = {};
    if (dto.action === 'accept') {
      data.response = 'accepted';
      data.reject_reason = null;
      data.reschedule_at = null;
      data.reschedule_note = null;
    } else if (dto.action === 'reject') {
      if (!dto.reason?.trim()) throw new BadRequestException('A reason is required to reject.');
      data.response = 'rejected';
      data.reject_reason = dto.reason.trim();
    } else {
      if (!dto.reschedule_at) throw new BadRequestException('A preferred date/time is required to request a reschedule.');
      data.response = 'reschedule_requested';
      data.reschedule_at = new Date(dto.reschedule_at);
      data.reschedule_note = dto.reschedule_note ?? null;
    }
    await this.prisma.meetingAttendee.update({ where: { id: attendee.id }, data });

    const event = dto.action === 'reschedule' ? 'meeting_reschedule_requested' : 'meeting_response';
    await this.notifications.emit({
      orgId, module: 'meetings', event_type: event,
      recipients: [meeting.created_by_user_id].filter((u) => u !== actor.id),
      title: 'Meeting response',
      body: `${await this.notifications.userName(actor.id)} ${dto.action === 'accept' ? 'accepted' : dto.action === 'reject' ? 'declined' : 'requested a reschedule for'} "${meeting.title}"`,
      link: `${LINK}/${id}`,
      entity: { type: 'meeting', id },
    });
    return this.getOne(orgId, actor, id);
  }

  async convertToPoll(orgId: string, actor: Actor, id: string) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireManage(orgId, meeting, actor);
    if (meeting.mode !== 'fixed') throw new BadRequestException('Only a fixed meeting can be converted to a poll.');

    const attendees = await this.prisma.meetingAttendee.findMany({ where: { meeting_id: id } });
    const slots: Prisma.MeetingSlotCreateManyInput[] = [];
    // keep original time as a candidate
    if (meeting.scheduled_start && meeting.scheduled_end) {
      slots.push({
        organization_id: orgId, meeting_id: id,
        start_at: meeting.scheduled_start, end_at: meeting.scheduled_end,
        source: 'caller', proposed_by_user_id: meeting.created_by_user_id,
      });
    }
    // seed from reschedule preferences
    const durationMs =
      meeting.scheduled_start && meeting.scheduled_end
        ? meeting.scheduled_end.getTime() - meeting.scheduled_start.getTime()
        : 60 * 60_000;
    for (const a of attendees) {
      if (a.reschedule_at) {
        slots.push({
          organization_id: orgId, meeting_id: id,
          start_at: a.reschedule_at, end_at: new Date(a.reschedule_at.getTime() + durationMs),
          source: 'invitee', proposed_by_user_id: a.user_id,
        });
      }
    }
    if (slots.length) await this.prisma.meetingSlot.createMany({ data: slots });

    await this.prisma.meeting.update({
      where: { id },
      data: {
        mode: 'poll', status: 'polling',
        poll_window_start: meeting.scheduled_start ?? new Date(),
        poll_window_end: meeting.scheduled_end ?? new Date(Date.now() + 14 * 86_400_000),
        poll_duration_min: Math.round(durationMs / 60_000),
      },
    });
    await this.audit.record({
      orgId, actorId: actor.id, action: 'update', resource: 'meeting',
      entityId: id, entityLabel: meeting.title,
      changes: { mode: { before: 'fixed', after: 'poll' } },
    });
    await this.notifications.emit({
      orgId, module: 'meetings', event_type: 'meeting_poll_opened',
      recipients: attendees.map((a) => a.user_id).filter((u) => u !== actor.id),
      title: 'Meeting moved to a time poll',
      body: `Pick the times that work for "${meeting.title}"`,
      link: `${LINK}/${id}`, entity: { type: 'meeting', id },
    });
    return this.getOne(orgId, actor, id);
  }

  // ─── Poll slots ────────────────────────────────────────────────────────────────
  async addSlot(orgId: string, actor: Actor, id: string, dto: AddSlotDto) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireAttendee(orgId, meeting, actor);
    if (meeting.status !== 'polling') throw new BadRequestException('Slots can only be added while the poll is open.');
    const isCaller = actor.id === meeting.created_by_user_id;
    await this.prisma.meetingSlot.create({
      data: {
        organization_id: orgId, meeting_id: id,
        start_at: new Date(dto.start_at), end_at: new Date(dto.end_at),
        source: isCaller ? 'caller' : 'invitee', proposed_by_user_id: actor.id,
      },
    });
    return this.getOne(orgId, actor, id);
  }

  async dismissSlot(orgId: string, actor: Actor, id: string, slotId: string) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireManage(orgId, meeting, actor); // caller owns the board
    await this.prisma.meetingSlot.updateMany({
      where: { id: slotId, meeting_id: id },
      data: { is_dismissed: true },
    });
    return this.getOne(orgId, actor, id);
  }

  async voteSlot(orgId: string, actor: Actor, id: string, slotId: string, dto: VoteSlotDto) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireAttendee(orgId, meeting, actor);
    if (meeting.status !== 'polling') throw new BadRequestException('Voting is closed.');
    const slot = await this.prisma.meetingSlot.findFirst({ where: { id: slotId, meeting_id: id, is_dismissed: false } });
    if (!slot) throw new NotFoundException('Slot not found');
    await this.prisma.meetingSlotVote.upsert({
      where: { slot_id_user_id: { slot_id: slotId, user_id: actor.id } },
      create: { organization_id: orgId, slot_id: slotId, meeting_id: id, user_id: actor.id, vote: dto.vote },
      update: { vote: dto.vote },
    });
    return this.getOne(orgId, actor, id);
  }

  async confirmSlot(orgId: string, actor: Actor, id: string, dto: ConfirmSlotDto) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireManage(orgId, meeting, actor);
    if (meeting.status !== 'polling') throw new BadRequestException('This meeting is not in a poll.');
    const slot = await this.prisma.meetingSlot.findFirst({ where: { id: dto.slot_id, meeting_id: id } });
    if (!slot) throw new NotFoundException('Slot not found');

    await this.prisma.meetingSlot.update({ where: { id: slot.id }, data: { is_confirmed: true } });
    await this.prisma.meeting.update({
      where: { id },
      data: { status: 'scheduled', scheduled_start: slot.start_at, scheduled_end: slot.end_at, reminder_sent: false },
    });

    // Auto-resolve attendee responses from their vote on the confirmed slot
    const [attendees, votes] = await Promise.all([
      this.prisma.meetingAttendee.findMany({ where: { meeting_id: id, is_organizer: false } }),
      this.prisma.meetingSlotVote.findMany({ where: { slot_id: slot.id } }),
    ]);
    const voteBy = new Map(votes.map((v) => [v.user_id, v.vote]));
    for (const a of attendees) {
      const v = voteBy.get(a.user_id);
      const response = v === 'available' || v === 'maybe' ? 'accepted' : v === 'unavailable' ? 'rejected' : 'pending';
      await this.prisma.meetingAttendee.update({ where: { id: a.id }, data: { response } });
    }

    await this.audit.record({
      orgId, actorId: actor.id, action: 'update', resource: 'meeting',
      entityId: id, entityLabel: meeting.title,
      changes: { scheduled_start: { before: null, after: slot.start_at } },
    });
    await this.notifications.emit({
      orgId, module: 'meetings', event_type: 'meeting_slot_confirmed',
      recipients: attendees.map((a) => a.user_id),
      title: 'Meeting time confirmed',
      body: `"${meeting.title}" is set for ${slot.start_at.toISOString()}`,
      link: `${LINK}/${id}`, entity: { type: 'meeting', id },
    });
    return this.getOne(orgId, actor, id);
  }

  // ─── Time capture / lifecycle ──────────────────────────────────────────────────
  async start(orgId: string, actor: Actor, id: string) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireManage(orgId, meeting, actor);
    if (meeting.status !== 'scheduled') throw new BadRequestException('Only a scheduled meeting can be started.');
    const now = await this.clock.now(orgId);
    await this.prisma.meeting.update({ where: { id }, data: { status: 'in_progress', actual_start: now } });
    await this.audit.record({ orgId, actorId: actor.id, action: 'update', resource: 'meeting', entityId: id, entityLabel: meeting.title, changes: { status: { before: 'scheduled', after: 'in_progress' } } });
    return this.getOne(orgId, actor, id);
  }

  async end(orgId: string, actor: Actor, id: string) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireManage(orgId, meeting, actor);
    if (meeting.status !== 'in_progress') throw new BadRequestException('Only a meeting in progress can be ended.');
    const now = await this.clock.now(orgId);
    await this.prisma.meeting.update({ where: { id }, data: { actual_end: now } });
    return this.getOne(orgId, actor, id);
  }

  async close(orgId: string, actor: Actor, id: string) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireManage(orgId, meeting, actor);
    if (meeting.status === 'closed') throw new BadRequestException('Meeting is already closed.');
    const now = await this.clock.now(orgId);
    await this.prisma.meeting.update({
      where: { id },
      data: { status: 'closed', actual_end: meeting.actual_end ?? now },
    });
    await this.audit.record({ orgId, actorId: actor.id, action: 'update', resource: 'meeting', entityId: id, entityLabel: meeting.title, changes: { status: { before: meeting.status, after: 'closed' } } });
    return this.getOne(orgId, actor, id);
  }

  async reopen(orgId: string, actor: Actor, id: string) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireManage(orgId, meeting, actor);
    if (meeting.status !== 'closed') throw new BadRequestException('Only a closed meeting can be reopened.');
    await this.prisma.meeting.update({ where: { id }, data: { status: 'in_progress' } });
    await this.audit.record({ orgId, actorId: actor.id, action: 'update', resource: 'meeting', entityId: id, entityLabel: meeting.title, changes: { status: { before: 'closed', after: 'in_progress' } } });
    return this.getOne(orgId, actor, id);
  }

  async cancel(orgId: string, actor: Actor, id: string, reason?: string) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireManage(orgId, meeting, actor);
    await this.prisma.meeting.update({ where: { id }, data: { status: 'cancelled' } });
    await this.audit.record({ orgId, actorId: actor.id, action: 'update', resource: 'meeting', entityId: id, entityLabel: meeting.title, changes: { status: { before: meeting.status, after: 'cancelled' } } });
    const attendees = await this.prisma.meetingAttendee.findMany({ where: { meeting_id: id } });
    await this.notifications.emit({
      orgId, module: 'meetings', event_type: 'meeting_cancelled',
      recipients: attendees.map((a) => a.user_id).filter((u) => u !== actor.id),
      title: 'Meeting cancelled', body: `"${meeting.title}" was cancelled${reason ? `: ${reason}` : ''}`,
      link: `${LINK}/${id}`, entity: { type: 'meeting', id },
    });
    return this.getOne(orgId, actor, id);
  }

  async markAttendance(orgId: string, actor: Actor, id: string, dto: MarkAttendanceDto) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireManage(orgId, meeting, actor);
    for (const row of dto.rows) {
      await this.prisma.meetingAttendee.updateMany({
        where: { meeting_id: id, user_id: row.user_id },
        data: {
          attended: row.attended,
          attended_in_at: row.attended_in_at ? new Date(row.attended_in_at) : null,
          attended_out_at: row.attended_out_at ? new Date(row.attended_out_at) : null,
        },
      });
    }
    return this.getOne(orgId, actor, id);
  }

  // ─── Private note ──────────────────────────────────────────────────────────────
  async upsertMyNote(orgId: string, actor: Actor, id: string, dto: PrivateNoteDto) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireAttendee(orgId, meeting, actor);
    await this.prisma.meetingPrivateNote.upsert({
      where: { meeting_id_user_id: { meeting_id: id, user_id: actor.id } },
      create: { organization_id: orgId, meeting_id: id, user_id: actor.id, body: dto.body },
      update: { body: dto.body },
    });
    return { success: true };
  }

  // ─── Action items ──────────────────────────────────────────────────────────────
  async addActionItem(orgId: string, actor: Actor, id: string, dto: CreateActionItemDto) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireAttendee(orgId, meeting, actor);
    this.assertOpen(meeting);
    const item = await this.prisma.meetingActionItem.create({
      data: {
        organization_id: orgId, meeting_id: id, text: dto.text.trim(),
        owner_user_id: dto.owner_user_id ?? null, due_date: dto.due_date ? new Date(dto.due_date) : null,
      },
    });
    await this.audit.record({ orgId, actorId: actor.id, action: 'update', resource: 'meeting', entityId: id, entityLabel: meeting.title, changes: { action_item_added: { before: null, after: item.text } } });
    return this.getOne(orgId, actor, id);
  }

  async updateActionItem(orgId: string, actor: Actor, id: string, itemId: string, dto: UpdateActionItemDto) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireAttendee(orgId, meeting, actor);
    this.assertOpen(meeting);
    const data: Prisma.MeetingActionItemUpdateInput = {};
    if (dto.text !== undefined) data.text = dto.text.trim();
    if (dto.owner_user_id !== undefined) data.owner_user_id = dto.owner_user_id;
    if (dto.due_date !== undefined) data.due_date = dto.due_date ? new Date(dto.due_date) : null;
    if (dto.is_done !== undefined) data.is_done = dto.is_done;
    await this.prisma.meetingActionItem.updateMany({ where: { id: itemId, meeting_id: id }, data });
    return this.getOne(orgId, actor, id);
  }

  async deleteActionItem(orgId: string, actor: Actor, id: string, itemId: string) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireAttendee(orgId, meeting, actor);
    this.assertOpen(meeting);
    await this.prisma.meetingActionItem.deleteMany({ where: { id: itemId, meeting_id: id } });
    return this.getOne(orgId, actor, id);
  }

  /** Attach an existing task or create a new one (via the Task module) and link it. */
  async linkTask(orgId: string, actor: Actor, id: string, itemId: string, dto: LinkTaskDto) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireAttendee(orgId, meeting, actor);
    const item = await this.prisma.meetingActionItem.findFirst({ where: { id: itemId, meeting_id: id } });
    if (!item) throw new NotFoundException('Action item not found');

    let taskId = dto.task_id;
    if (!taskId && dto.create) {
      const task = await this.tasks.createTask(orgId, actor.id, {
        title: dto.create.title,
        assignee_user_ids: dto.create.assignee_user_ids,
        deadline: dto.create.deadline,
        goal_id: meeting.link_type === 'goal' ? meeting.link_entity_id ?? undefined : undefined,
      } as any);
      taskId = task.id;
    }
    if (!taskId) throw new BadRequestException('Provide a task to attach or details to create one.');

    await this.prisma.meetingActionItem.update({ where: { id: itemId }, data: { linked_task_id: taskId } });
    return this.getOne(orgId, actor, id);
  }

  // ─── Decisions ───────────────────────────────────────────────────────────────
  async addDecision(orgId: string, actor: Actor, id: string, dto: CreateDecisionDto) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireAttendee(orgId, meeting, actor);
    this.assertOpen(meeting);
    const d = await this.prisma.meetingDecision.create({
      data: {
        organization_id: orgId, meeting_id: id, decision: dto.decision.trim(),
        owner_user_id: dto.owner_user_id ?? null,
        decided_on: dto.decided_on ? new Date(dto.decided_on) : await this.clock.now(orgId),
        reason: dto.reason ?? null,
        affects_link_type: dto.affects_link_type ?? null,
        affects_entity_id: dto.affects_entity_id ?? null,
      },
    });
    await this.audit.record({ orgId, actorId: actor.id, action: 'update', resource: 'meeting', entityId: id, entityLabel: meeting.title, changes: { decision_added: { before: null, after: d.decision } } });
    return this.getOne(orgId, actor, id);
  }

  async updateDecision(orgId: string, actor: Actor, id: string, decisionId: string, dto: UpdateDecisionDto) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireAttendee(orgId, meeting, actor);
    this.assertOpen(meeting);
    const data: Prisma.MeetingDecisionUpdateInput = {};
    if (dto.decision !== undefined) data.decision = dto.decision.trim();
    if (dto.owner_user_id !== undefined) data.owner_user_id = dto.owner_user_id;
    if (dto.decided_on !== undefined) data.decided_on = new Date(dto.decided_on);
    if (dto.reason !== undefined) data.reason = dto.reason;
    if (dto.affects_link_type !== undefined) data.affects_link_type = dto.affects_link_type;
    if (dto.affects_entity_id !== undefined) data.affects_entity_id = dto.affects_entity_id;
    await this.prisma.meetingDecision.updateMany({ where: { id: decisionId, meeting_id: id }, data });
    return this.getOne(orgId, actor, id);
  }

  async deleteDecision(orgId: string, actor: Actor, id: string, decisionId: string) {
    const meeting = await this.findOrFail(orgId, id);
    await this.requireAttendee(orgId, meeting, actor);
    this.assertOpen(meeting);
    await this.prisma.meetingDecision.deleteMany({ where: { id: decisionId, meeting_id: id } });
    return this.getOne(orgId, actor, id);
  }

  /** Org-wide decision log across meetings. */
  async listDecisions(orgId: string, filters: Record<string, string | undefined>) {
    const where: Prisma.MeetingDecisionWhereInput = {
      organization_id: orgId,
      meeting: { is_deleted: false },
    };
    if (filters.owner_user_id) where.owner_user_id = filters.owner_user_id;
    if (filters.from_date || filters.to_date) {
      where.decided_on = {};
      if (filters.from_date) (where.decided_on as any).gte = new Date(filters.from_date);
      if (filters.to_date) (where.decided_on as any).lte = new Date(filters.to_date);
    }
    if (filters.search) where.decision = { contains: filters.search, mode: 'insensitive' };
    return this.prisma.meetingDecision.findMany({
      where,
      orderBy: { decided_on: 'desc' },
      include: { meeting: { select: { id: true, title: true } } },
    });
  }

  // ─── Edit log (reads the shared audit log) ─────────────────────────────────────
  async getEditLog(orgId: string, id: string) {
    await this.findOrFail(orgId, id);
    return this.audit.list(orgId, { resource: 'meeting', entity_id: id, take: 200 });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────────
  private async findOrFail(orgId: string, id: string) {
    const m = await this.prisma.meeting.findFirst({ where: { id, organization_id: orgId, is_deleted: false } });
    if (!m) throw new NotFoundException('Meeting not found');
    return m;
  }

  private async getAttendeeOrFail(meetingId: string, userId: string) {
    const a = await this.prisma.meetingAttendee.findUnique({ where: { meeting_id_user_id: { meeting_id: meetingId, user_id: userId } } });
    if (!a) throw new ForbiddenException('You are not an attendee of this meeting.');
    return a;
  }

  private async requireAttendee(orgId: string, meeting: { id: string; created_by_user_id: string }, actor: Actor) {
    if (actor.id === meeting.created_by_user_id) return;
    const a = await this.prisma.meetingAttendee.findUnique({ where: { meeting_id_user_id: { meeting_id: meeting.id, user_id: actor.id } } });
    if (!a && !(await this.canManage(orgId, meeting.created_by_user_id, actor))) {
      throw new ForbiddenException('You are not part of this meeting.');
    }
  }

  private async canManage(orgId: string, organizerId: string, actor: Actor): Promise<boolean> {
    if (actor.id === organizerId) return true;
    return this.permissions.hasEffective(
      orgId,
      { userId: actor.id, systemRoleId: actor.system_role_id, isAdmin: actor.is_admin, isSuperAdmin: actor.isSuperAdmin },
      MEETING,
      'edit',
    );
  }

  private async requireManage(orgId: string, meeting: { created_by_user_id: string }, actor: Actor) {
    if (!(await this.canManage(orgId, meeting.created_by_user_id, actor))) {
      throw new ForbiddenException('Only the organiser (or a user with edit rights) can do this.');
    }
  }

  private assertOpen(meeting: { status: string }) {
    if (meeting.status === 'closed') throw new BadRequestException('This meeting is closed — its record is locked.');
    if (meeting.status === 'cancelled') throw new BadRequestException('This meeting was cancelled.');
  }

  private async syncAttendees(orgId: string, meetingId: string, userIds: string[], organizerId: string) {
    // Fail loud: newly added attendees must be eligible meeting subjects.
    await this.subjects.assertAllEligible(
      orgId,
      'meetings.subject.invitable',
      userIds.filter((u) => u !== organizerId),
    );
    const wanted = new Set(userIds.concat(organizerId));
    const existing = await this.prisma.meetingAttendee.findMany({ where: { meeting_id: meetingId } });
    const existingIds = new Set(existing.map((a) => a.user_id));
    const toAdd = [...wanted].filter((u) => !existingIds.has(u));
    const toRemove = existing.filter((a) => !wanted.has(a.user_id) && !a.is_organizer).map((a) => a.id);
    if (toAdd.length) {
      await this.prisma.meetingAttendee.createMany({
        data: toAdd.map((uid) => ({ organization_id: orgId, meeting_id: meetingId, user_id: uid, is_organizer: uid === organizerId, response: uid === organizerId ? ('accepted' as const) : ('pending' as const) })),
        skipDuplicates: true,
      });
    }
    if (toRemove.length) await this.prisma.meetingAttendee.deleteMany({ where: { id: { in: toRemove } } });
  }

  /** Overlapping accepted meetings for any of the given users (a soft conflict signal). */
  async conflictsFor(orgId: string, userIds: string[], start: Date, end: Date, excludeMeetingId?: string) {
    if (!userIds.length) return [];
    const meetings = await this.prisma.meeting.findMany({
      where: {
        organization_id: orgId,
        is_deleted: false,
        id: excludeMeetingId ? { not: excludeMeetingId } : undefined,
        status: { in: ['scheduled', 'in_progress'] },
        scheduled_start: { lt: end },
        scheduled_end: { gt: start },
        attendees: { some: { user_id: { in: userIds }, response: 'accepted' } },
      },
      select: {
        id: true, title: true, scheduled_start: true, scheduled_end: true,
        attendees: { where: { user_id: { in: userIds }, response: 'accepted' }, select: { user_id: true } },
      },
    });
    return meetings.flatMap((m) =>
      m.attendees.map((a) => ({ user_id: a.user_id, meeting_id: m.id, title: m.title, scheduled_start: m.scheduled_start })),
    );
  }

  /** Generate up to 3 calendar-aware "suggested" slots (never guaranteed-free). */
  private async generateSystemSlots(
    orgId: string,
    meetingId: string,
    attendeeIds: string[],
    win: { windowStart: Date; windowEnd: Date; durationMin: number },
  ) {
    const HOURS = [9, 11, 14, 16];
    const durationMs = win.durationMin * 60_000;
    const candidates: { start: Date; end: Date }[] = [];
    const cursor = new Date(win.windowStart);
    cursor.setHours(0, 0, 0, 0);
    let days = 0;
    while (cursor <= win.windowEnd && days < 21) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) {
        for (const h of HOURS) {
          const start = new Date(cursor);
          start.setHours(h, 0, 0, 0);
          const end = new Date(start.getTime() + durationMs);
          if (start >= win.windowStart && end <= win.windowEnd) candidates.push({ start, end });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
      days++;
    }
    if (!candidates.length) return;

    // Accepted meetings in the window for these attendees
    const busy = await this.prisma.meeting.findMany({
      where: {
        organization_id: orgId, is_deleted: false,
        status: { in: ['scheduled', 'in_progress'] },
        scheduled_start: { lt: win.windowEnd }, scheduled_end: { gt: win.windowStart },
        attendees: { some: { user_id: { in: attendeeIds }, response: 'accepted' } },
      },
      select: { scheduled_start: true, scheduled_end: true },
    });
    const ranked = candidates
      .map((c) => ({
        ...c,
        conflicts: busy.filter((b) => b.scheduled_start! < c.end && b.scheduled_end! > c.start).length,
      }))
      .sort((a, b) => a.conflicts - b.conflicts)
      .slice(0, 3);

    await this.prisma.meetingSlot.createMany({
      data: ranked.map((r, i) => ({
        organization_id: orgId, meeting_id: meetingId,
        start_at: r.start, end_at: r.end, source: 'system' as const, system_rank: i,
      })),
    });
  }
}
