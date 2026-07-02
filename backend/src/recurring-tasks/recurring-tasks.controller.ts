import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RecurringTasksService } from './recurring-tasks.service';
import { RecurringAttachmentsService } from './recurring-attachments.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { ClockService } from '../clock/clock.service';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';
import { CreateScheduleEntryDto } from './dto/create-schedule-entry.dto';
import { MAX_ATTACHMENT_BYTES, type UploadedFile as UploadedFileType } from '../tasks/task-attachments.service';

@ApiTags('recurring-tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/org/:orgId/tasks/recurring')
export class RecurringTasksController {
  constructor(
    private readonly service: RecurringTasksService,
    private readonly attachments: RecurringAttachmentsService,
    private readonly scheduler: SchedulerService,
    private readonly clock: ClockService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List recurring task templates' })
  list(@Param('orgId') orgId: string) {
    return this.service.listTemplates(orgId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a recurring task template' })
  async create(@Param('orgId') orgId: string, @Request() req: any, @Body() dto: CreateRecurringDto) {
    const template = await this.service.createTemplate(orgId, req.user.id, dto);
    // Immediately spawn today's occurrence if the schedule fires today (org's effective clock)
    const now = await this.clock.now(orgId);
    this.scheduler.spawnForTemplate(orgId, template!.id, false, now).catch(() => null);
    return template;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a recurring task template' })
  update(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateRecurringDto) {
    return this.service.updateTemplate(orgId, id, dto);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a recurring task template' })
  pause(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.pauseTemplate(orgId, id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused recurring task template' })
  async resume(@Param('orgId') orgId: string, @Param('id') id: string) {
    const template = await this.service.resumeTemplate(orgId, id);
    // Immediately spawn today's occurrence if the schedule fires today (org's effective clock)
    const now = await this.clock.now(orgId);
    this.scheduler.spawnForTemplate(orgId, id, false, now).catch(() => null);
    return template;
  }

  @Post(':id/spawn-today')
  @ApiOperation({ summary: 'Manually trigger today\'s spawn for a recurring template' })
  async spawnToday(@Param('orgId') orgId: string, @Param('id') id: string) {
    const now = await this.clock.now(orgId);
    return this.scheduler.spawnForTemplate(orgId, id, true, now);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete or stop a recurring task template' })
  remove(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Query('mode') mode?: 'stop' | 'delete-future' | 'delete-all',
  ) {
    return this.service.deleteTemplate(orgId, id, mode ?? 'stop');
  }

  @Get(':id/instances')
  @ApiOperation({ summary: 'Get task instances spawned from a template' })
  getInstances(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getInstances(orgId, id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get completion stats for a recurring template' })
  getStats(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getStats(orgId, id);
  }

  // ─── Attachments (carried into every spawned instance) ───────────────────────

  @Post(':id/attachments')
  @ApiOperation({ summary: 'Upload a document attachment to a recurring template' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  uploadAttachment(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileType,
  ) {
    return this.attachments.upload(orgId, req.user.id, id, file);
  }

  @Get(':id/attachments')
  @ApiOperation({ summary: 'List attachments on a recurring template' })
  listAttachments(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.attachments.listForTemplate(orgId, id);
  }

  @Get(':id/attachments/:attachmentId/download')
  @ApiOperation({ summary: 'Get a short-lived signed download URL for a template attachment' })
  downloadAttachment(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachments.getDownloadUrl(orgId, id, attachmentId);
  }

  @Delete(':id/attachments/:attachmentId')
  @ApiOperation({ summary: 'Remove a template attachment (uploader only)' })
  removeAttachment(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachments.remove(orgId, req.user.id, id, attachmentId);
  }

  // ─── Schedule Entries ───────────────────────────────────────────────────────

  @Get(':id/schedules')
  @ApiOperation({ summary: 'List schedule entries for a template' })
  listSchedules(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.listScheduleEntries(orgId, id);
  }

  @Post(':id/schedules')
  @ApiOperation({ summary: 'Add a schedule entry to a template' })
  addSchedule(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: CreateScheduleEntryDto,
  ) {
    return this.service.addScheduleEntry(orgId, id, dto);
  }

  @Patch(':id/schedules/:eid')
  @ApiOperation({ summary: 'Update a schedule entry' })
  updateSchedule(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Param('eid') eid: string,
    @Body() dto: Partial<CreateScheduleEntryDto>,
  ) {
    return this.service.updateScheduleEntry(orgId, id, eid, dto);
  }

  @Delete(':id/schedules/:eid')
  @ApiOperation({ summary: 'Delete a schedule entry' })
  deleteSchedule(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Param('eid') eid: string,
  ) {
    return this.service.deleteScheduleEntry(orgId, id, eid);
  }
}
