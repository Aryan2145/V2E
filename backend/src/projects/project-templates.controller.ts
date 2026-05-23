import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { ProjectTemplatesService } from './project-templates.service';
import { CreateProjectTemplateDto } from './dto/create-project-template.dto';

@ApiTags('project-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/projects/templates')
export class ProjectTemplatesController {
  constructor(private readonly service: ProjectTemplatesService) {}

  @Get()
  list(@Param('orgId') orgId: string) {
    return this.service.listTemplates(orgId);
  }

  @Post()
  create(@Param('orgId') orgId: string, @Request() req: any, @Body() dto: CreateProjectTemplateDto) {
    return this.service.createTemplate(orgId, req.user.id, dto);
  }

  @Get(':id')
  get(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getTemplate(orgId, id);
  }

  @Patch(':id')
  update(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: Partial<CreateProjectTemplateDto>) {
    return this.service.updateTemplate(orgId, id, dto);
  }

  @Delete(':id')
  deactivate(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.deactivateTemplate(orgId, id);
  }

  // ─── Milestones ──────────────────────────────────────────────────────────────

  @Post(':id/milestones')
  addMilestone(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: { name: string; description?: string; order_index?: number }) {
    return this.service.addMilestone(orgId, id, dto);
  }

  @Patch(':id/milestones/:mid')
  updateMilestone(@Param('orgId') orgId: string, @Param('id') id: string, @Param('mid') mid: string, @Body() dto: Partial<{ name: string; description: string; order_index: number }>) {
    return this.service.updateMilestone(orgId, id, mid, dto);
  }

  @Delete(':id/milestones/:mid')
  deleteMilestone(@Param('orgId') orgId: string, @Param('id') id: string, @Param('mid') mid: string) {
    return this.service.deleteMilestone(orgId, id, mid);
  }

  // ─── Tasks ───────────────────────────────────────────────────────────────────

  @Post(':id/tasks')
  addTask(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: {
      title: string; description?: string; priority_id?: string; milestone_id?: string;
      estimated_days?: number; default_assignee_user_id?: string; default_assignee_role?: string;
      order_index?: number; checklist_items?: { title: string }[];
    },
  ) {
    return this.service.addTask(orgId, id, dto);
  }

  @Patch(':id/tasks/:tid')
  updateTask(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Param('tid') tid: string,
    @Body() dto: Partial<{ title: string; description: string; priority_id: string; milestone_id: string; estimated_days: number; default_assignee_user_id: string; default_assignee_role: string; order_index: number }>,
  ) {
    return this.service.updateTask(orgId, id, tid, dto);
  }

  @Delete(':id/tasks/:tid')
  deleteTask(@Param('orgId') orgId: string, @Param('id') id: string, @Param('tid') tid: string) {
    return this.service.deleteTask(orgId, id, tid);
  }
}
