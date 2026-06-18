import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionAction } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { MeetingsService, Actor } from './meetings.service';
import { MeetingsReportsService } from './meetings-reports.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import {
  UpdateMeetingDto,
  DeleteMeetingDto,
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

const MEETINGS = 'meetings';

function actorOf(req: any): Actor {
  return { id: req.user.id, role: req.user.role ?? null, isSuperAdmin: !!req.user.isSuperAdmin };
}

@ApiTags('meetings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard, PermissionsGuard)
@Controller('api/v1/org/:orgId/meetings')
export class MeetingsController {
  constructor(
    private readonly service: MeetingsService,
    private readonly reports: MeetingsReportsService,
  ) {}

  // ─── List / detail ──────────────────────────────────────────────────────────
  @Get()
  @RequirePermission(MEETINGS, PermissionAction.read)
  @ApiOperation({ summary: 'List meetings' })
  list(@Param('orgId') orgId: string, @Request() req: any, @Query() query: Record<string, string>) {
    return this.service.list(orgId, actorOf(req), query);
  }

  @Get('reports')
  @RequirePermission(MEETINGS, PermissionAction.read)
  @ApiOperation({ summary: 'Aggregated meeting reports (viewer-scoped)' })
  reportsAggregate(@Param('orgId') orgId: string, @Request() req: any, @Query() query: Record<string, string>) {
    return this.reports.report(orgId, actorOf(req), query);
  }

  @Get('decisions')
  @RequirePermission(MEETINGS, PermissionAction.read)
  @ApiOperation({ summary: 'Org-wide decision log' })
  decisionLog(@Param('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.service.listDecisions(orgId, query);
  }

  @Get(':id')
  @RequirePermission(MEETINGS, PermissionAction.read)
  getOne(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any) {
    return this.service.getOne(orgId, actorOf(req), id);
  }

  @Get(':id/analytics')
  @RequirePermission(MEETINGS, PermissionAction.read)
  analytics(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.reports.analytics(orgId, id);
  }

  @Get(':id/edit-log')
  @RequirePermission(MEETINGS, PermissionAction.read)
  editLog(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getEditLog(orgId, id);
  }

  // ─── Create / update / delete ─────────────────────────────────────────────────
  @Post()
  @RequirePermission(MEETINGS, PermissionAction.write)
  create(@Param('orgId') orgId: string, @Request() req: any, @Body() dto: CreateMeetingDto) {
    return this.service.create(orgId, actorOf(req), dto);
  }

  @Patch(':id')
  @RequirePermission(MEETINGS, PermissionAction.read)
  update(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any, @Body() dto: UpdateMeetingDto) {
    return this.service.update(orgId, actorOf(req), id, dto);
  }

  @Delete(':id')
  @RequirePermission(MEETINGS, PermissionAction.delete)
  remove(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any, @Body() dto: DeleteMeetingDto) {
    return this.service.remove(orgId, actorOf(req), id, dto?.reason);
  }

  // ─── Shared record ─────────────────────────────────────────────────────────────
  @Put(':id/record')
  @RequirePermission(MEETINGS, PermissionAction.read)
  updateRecord(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any, @Body() dto: UpdateRecordDto) {
    return this.service.updateRecord(orgId, actorOf(req), id, dto);
  }

  // ─── Scheduling: fixed responses + poll ────────────────────────────────────────
  @Post(':id/respond')
  @RequirePermission(MEETINGS, PermissionAction.read)
  respond(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any, @Body() dto: RespondDto) {
    return this.service.respond(orgId, actorOf(req), id, dto);
  }

  @Post(':id/convert-to-poll')
  @RequirePermission(MEETINGS, PermissionAction.read)
  convert(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any) {
    return this.service.convertToPoll(orgId, actorOf(req), id);
  }

  @Post(':id/slots')
  @RequirePermission(MEETINGS, PermissionAction.read)
  addSlot(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any, @Body() dto: AddSlotDto) {
    return this.service.addSlot(orgId, actorOf(req), id, dto);
  }

  @Delete(':id/slots/:slotId')
  @RequirePermission(MEETINGS, PermissionAction.read)
  dismissSlot(@Param('orgId') orgId: string, @Param('id') id: string, @Param('slotId') slotId: string, @Request() req: any) {
    return this.service.dismissSlot(orgId, actorOf(req), id, slotId);
  }

  @Post(':id/slots/:slotId/vote')
  @RequirePermission(MEETINGS, PermissionAction.read)
  vote(@Param('orgId') orgId: string, @Param('id') id: string, @Param('slotId') slotId: string, @Request() req: any, @Body() dto: VoteSlotDto) {
    return this.service.voteSlot(orgId, actorOf(req), id, slotId, dto);
  }

  @Post(':id/confirm-slot')
  @RequirePermission(MEETINGS, PermissionAction.read)
  confirm(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any, @Body() dto: ConfirmSlotDto) {
    return this.service.confirmSlot(orgId, actorOf(req), id, dto);
  }

  // ─── Lifecycle / time capture ──────────────────────────────────────────────────
  @Post(':id/start')
  @RequirePermission(MEETINGS, PermissionAction.read)
  start(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any) {
    return this.service.start(orgId, actorOf(req), id);
  }

  @Post(':id/end')
  @RequirePermission(MEETINGS, PermissionAction.read)
  end(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any) {
    return this.service.end(orgId, actorOf(req), id);
  }

  @Post(':id/close')
  @RequirePermission(MEETINGS, PermissionAction.read)
  close(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any) {
    return this.service.close(orgId, actorOf(req), id);
  }

  @Post(':id/cancel')
  @RequirePermission(MEETINGS, PermissionAction.read)
  cancel(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any, @Body() dto: DeleteMeetingDto) {
    return this.service.cancel(orgId, actorOf(req), id, dto?.reason);
  }

  @Post(':id/reopen')
  @RequirePermission(MEETINGS, PermissionAction.read)
  reopen(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any) {
    return this.service.reopen(orgId, actorOf(req), id);
  }

  @Post(':id/attendance')
  @RequirePermission(MEETINGS, PermissionAction.read)
  attendance(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any, @Body() dto: MarkAttendanceDto) {
    return this.service.markAttendance(orgId, actorOf(req), id, dto);
  }

  // ─── Private note ──────────────────────────────────────────────────────────────
  @Put(':id/my-note')
  @RequirePermission(MEETINGS, PermissionAction.read)
  myNote(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any, @Body() dto: PrivateNoteDto) {
    return this.service.upsertMyNote(orgId, actorOf(req), id, dto);
  }

  // ─── Action items ──────────────────────────────────────────────────────────────
  @Post(':id/action-items')
  @RequirePermission(MEETINGS, PermissionAction.read)
  addActionItem(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any, @Body() dto: CreateActionItemDto) {
    return this.service.addActionItem(orgId, actorOf(req), id, dto);
  }

  @Patch(':id/action-items/:itemId')
  @RequirePermission(MEETINGS, PermissionAction.read)
  updateActionItem(@Param('orgId') orgId: string, @Param('id') id: string, @Param('itemId') itemId: string, @Request() req: any, @Body() dto: UpdateActionItemDto) {
    return this.service.updateActionItem(orgId, actorOf(req), id, itemId, dto);
  }

  @Delete(':id/action-items/:itemId')
  @RequirePermission(MEETINGS, PermissionAction.read)
  deleteActionItem(@Param('orgId') orgId: string, @Param('id') id: string, @Param('itemId') itemId: string, @Request() req: any) {
    return this.service.deleteActionItem(orgId, actorOf(req), id, itemId);
  }

  @Post(':id/action-items/:itemId/link-task')
  @RequirePermission(MEETINGS, PermissionAction.read)
  linkTask(@Param('orgId') orgId: string, @Param('id') id: string, @Param('itemId') itemId: string, @Request() req: any, @Body() dto: LinkTaskDto) {
    return this.service.linkTask(orgId, actorOf(req), id, itemId, dto);
  }

  // ─── Decisions ───────────────────────────────────────────────────────────────
  @Post(':id/decisions')
  @RequirePermission(MEETINGS, PermissionAction.read)
  addDecision(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any, @Body() dto: CreateDecisionDto) {
    return this.service.addDecision(orgId, actorOf(req), id, dto);
  }

  @Patch(':id/decisions/:decisionId')
  @RequirePermission(MEETINGS, PermissionAction.read)
  updateDecision(@Param('orgId') orgId: string, @Param('id') id: string, @Param('decisionId') decisionId: string, @Request() req: any, @Body() dto: UpdateDecisionDto) {
    return this.service.updateDecision(orgId, actorOf(req), id, decisionId, dto);
  }

  @Delete(':id/decisions/:decisionId')
  @RequirePermission(MEETINGS, PermissionAction.read)
  deleteDecision(@Param('orgId') orgId: string, @Param('id') id: string, @Param('decisionId') decisionId: string, @Request() req: any) {
    return this.service.deleteDecision(orgId, actorOf(req), id, decisionId);
  }
}
