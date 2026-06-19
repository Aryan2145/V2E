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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { RequireAdmin } from '../common/decorators/require-admin.decorator';
import { TasksService } from './tasks.service';
import { principalFromUser } from '../access-rights/permissions.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { AddAssigneeDto } from './dto/add-assignee.dto';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  // ─── Task CRUD ────────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a task' })
  create(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Body() dto: CreateTaskDto,
  ) {
    return this.service.createTask(orgId, req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tasks with filters' })
  list(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Query('status_id') status_id?: string,
    @Query('priority_id') priority_id?: string,
    @Query('category_id') category_id?: string,
    @Query('quadrant') quadrant?: string,
    @Query('type') type?: string,
    @Query('assignee_user_id') assignee_user_id?: string,
    @Query('goal_id') goal_id?: string,
    @Query('search') search?: string,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
  ) {
    return this.service.listTasks(orgId, principalFromUser(req.user), {
      status_id, priority_id, category_id, quadrant, type,
      assignee_user_id, goal_id, search, from_date, to_date,
    });
  }

  // ─── Specific sub-routes (must be BEFORE /:id) ───────────────────────────────

  @Get('eligible-assignees')
  @ApiOperation({ summary: 'Get eligible assignees based on visibility rules' })
  getEligibleAssignees(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Query('search') search?: string,
    @Query('sort') sort?: 'frequency' | 'workload' | 'name',
  ) {
    return this.service.getEligibleAssignees(orgId, req.user.id, search, sort ?? 'frequency');
  }

  @Get('archive')
  @ApiOperation({ summary: 'Get archived (deleted) tasks' })
  getArchive(@Param('orgId') orgId: string, @Request() req: any) {
    return this.service.getArchive(orgId, req.user.id);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get tasks assigned to me' })
  getMyTasks(@Param('orgId') orgId: string, @Request() req: any) {
    return this.service.getMyTasks(orgId, req.user.id);
  }

  @Get('cc')
  @ApiOperation({ summary: 'Get tasks where I am CC\'d' })
  getMyCCTasks(@Param('orgId') orgId: string, @Request() req: any) {
    return this.service.getMyCCTasks(orgId, req.user.id);
  }

  @Get('assigned-by-me')
  @ApiOperation({ summary: 'Get tasks I created' })
  getAssignedByMe(@Param('orgId') orgId: string, @Request() req: any) {
    return this.service.getTasksAssignedByMe(orgId, req.user.id);
  }

  @Get('escalated')
  @ApiOperation({ summary: 'Get tasks escalated to me' })
  getEscalated(@Param('orgId') orgId: string, @Request() req: any) {
    return this.service.getEscalatedTasks(orgId, req.user.id);
  }

  @Get('reports')
  @RequireAdmin()
  @ApiOperation({ summary: 'Get task analytics and reports' })
  getReports(
    @Param('orgId') orgId: string,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
  ) {
    return this.service.getReports(orgId, from_date, to_date);
  }

  // ─── /:id routes ─────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  getOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getTask(orgId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  update(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.service.updateTask(orgId, req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a task (requires reason)' })
  remove(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.service.deleteTask(orgId, req.user.id, id, body.reason);
  }

  // ─── Task Actions ─────────────────────────────────────────────────────────────

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark task as complete' })
  complete(@Param('orgId') orgId: string, @Request() req: any, @Param('id') id: string) {
    return this.service.completeTask(orgId, req.user.id, id);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Reopen a completed task (within window)' })
  reopen(@Param('orgId') orgId: string, @Request() req: any, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.service.reopenTask(orgId, req.user.id, id, body?.reason);
  }

  @Post(':id/proof')
  @ApiOperation({ summary: 'Submit proof of completion' })
  submitProof(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { proof_url: string },
  ) {
    return this.service.submitProof(orgId, req.user.id, id, body.proof_url);
  }

  // ─── Activity Logs ────────────────────────────────────────────────────────────

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get task activity log' })
  getLogs(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getActivityLog(orgId, id);
  }

  // ─── Comments ────────────────────────────────────────────────────────────────

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get task comments' })
  getComments(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getComments(orgId, id);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a task' })
  addComment(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.service.addComment(orgId, req.user.id, id, dto);
  }

  @Delete(':id/comments/:commentId')
  @ApiOperation({ summary: 'Soft-delete a comment' })
  deleteComment(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Param('commentId') commentId: string,
  ) {
    return this.service.deleteComment(orgId, req.user.id, commentId);
  }

  // ─── Checklist ────────────────────────────────────────────────────────────────

  @Patch(':id/checklist/:itemId')
  @ApiOperation({ summary: 'Toggle checklist item completion' })
  toggleChecklist(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.toggleChecklistItem(orgId, req.user.id, id, itemId);
  }

  // ─── Assignees ────────────────────────────────────────────────────────────────

  @Post(':id/assignees')
  @ApiOperation({ summary: 'Add an assignee to a task' })
  addAssignee(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: AddAssigneeDto,
  ) {
    return this.service.addAssignee(orgId, req.user.id, id, dto);
  }

  @Delete(':id/assignees/:userId')
  @ApiOperation({ summary: 'Remove an assignee from a task' })
  removeAssignee(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Param('id') id: string,
    @Param('userId') assigneeUserId: string,
  ) {
    return this.service.removeAssignee(orgId, req.user.id, id, assigneeUserId);
  }
}
