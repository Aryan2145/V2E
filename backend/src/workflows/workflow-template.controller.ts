import {
  Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, Query,
} from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { OrgScopeGuard } from '../common/guards/org-scope.guard'
import { RequireAdmin } from '../common/decorators/require-admin.decorator'
import { WorkflowTemplateService } from './workflow-template.service'
import { WorkflowEngineService } from './workflow-engine.service'
import { CreateTemplateDto } from './dto/create-template.dto'
import { UpdateTemplateDto } from './dto/update-template.dto'
import { CreateStepDto } from './dto/create-step.dto'
import { UpdateStepDto } from './dto/update-step.dto'
import { CreateTriggerDto } from './dto/create-trigger.dto'
import { ReorderStepsDto, SwapStepsDto } from './dto/reorder-steps.dto'
import { TriggerInstanceDto } from './dto/trigger-instance.dto'

@Controller('api/v1/org/:orgId/workflows')
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
export class WorkflowTemplateController {
  constructor(
    private readonly templateService: WorkflowTemplateService,
    private readonly engineService: WorkflowEngineService,
  ) {}

  // ── Masters ──────────────────────────────────────────────────────────────────

  @Get('masters')
  getMaster(@Param('orgId') orgId: string) {
    return this.templateService.getMaster(orgId)
  }

  @Patch('masters')
  @RequireAdmin()
  updateMaster(@Param('orgId') orgId: string, @Body() dto: Partial<{ workflow_creation_roles: string[]; default_overdue_action: string }>) {
    return this.templateService.updateMaster(orgId, dto)
  }

  // ── My workflows ─────────────────────────────────────────────────────────────

  @Get('my/owned')
  getOwnedWorkflows(@Param('orgId') orgId: string, @Req() req: any) {
    return this.templateService.getOwnedWorkflows(orgId, req.user.id)
  }

  @Get('my/owned/instances')
  getOwnedInstances(@Param('orgId') orgId: string, @Req() req: any) {
    return this.templateService.getOwnedInstances(orgId, req.user.id)
  }

  // ── Notifications ─────────────────────────────────────────────────────────────

  @Get('notifications')
  getNotifications(@Param('orgId') orgId: string, @Req() req: any) {
    return this.engineService.getNotifications(orgId, req.user.id)
  }

  @Patch('notifications/:id/read')
  markNotificationRead(@Param('orgId') orgId: string, @Req() req: any, @Param('id') id: string) {
    return this.engineService.markNotificationRead(orgId, req.user.id, id)
  }

  // ── Templates ────────────────────────────────────────────────────────────────

  @Get()
  listTemplates(@Param('orgId') orgId: string, @Req() req: any) {
    return this.templateService.listTemplates(orgId, req.user.id)
  }

  @Post()
  createTemplate(@Param('orgId') orgId: string, @Req() req: any, @Body() dto: CreateTemplateDto) {
    return this.templateService.createTemplate(orgId, req.user.id, dto)
  }

  @Get(':id')
  getTemplate(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.templateService.getTemplate(orgId, id)
  }

  @Patch(':id')
  updateTemplate(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any, @Body() dto: UpdateTemplateDto) {
    return this.templateService.updateTemplate(orgId, id, req.user.id, dto)
  }

  @Post(':id/publish')
  publishTemplate(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any) {
    return this.templateService.publishTemplate(orgId, id, req.user.id)
  }

  @Delete(':id')
  archiveTemplate(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any) {
    return this.templateService.archiveTemplate(orgId, id, req.user.id)
  }

  // ── Steps ────────────────────────────────────────────────────────────────────

  @Post(':id/steps')
  addStep(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any, @Body() dto: CreateStepDto) {
    return this.templateService.addStep(orgId, id, req.user.id, dto)
  }

  @Patch(':id/steps/:stepId')
  updateStep(@Param('orgId') orgId: string, @Param('id') id: string, @Param('stepId') stepId: string, @Req() req: any, @Body() dto: UpdateStepDto) {
    return this.templateService.updateStep(orgId, id, stepId, req.user.id, dto)
  }

  @Delete(':id/steps/:stepId')
  deleteStep(@Param('orgId') orgId: string, @Param('id') id: string, @Param('stepId') stepId: string, @Req() req: any) {
    return this.templateService.deleteStep(orgId, id, stepId, req.user.id)
  }

  @Post(':id/steps/reorder')
  reorderSteps(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any, @Body() dto: ReorderStepsDto) {
    return this.templateService.reorderSteps(orgId, id, req.user.id, dto.items)
  }

  @Post(':id/steps/swap')
  swapSteps(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any, @Body() dto: SwapStepsDto) {
    return this.templateService.swapSteps(orgId, id, req.user.id, dto.stepId1, dto.stepId2)
  }

  // ── Triggers ─────────────────────────────────────────────────────────────────

  @Get(':id/triggers')
  listTriggers(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.templateService.listTriggers(orgId, id)
  }

  @Post(':id/triggers')
  addTrigger(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any, @Body() dto: CreateTriggerDto) {
    return this.templateService.addTrigger(orgId, id, req.user.id, dto)
  }

  @Patch(':id/triggers/:triggerId')
  updateTrigger(@Param('orgId') orgId: string, @Param('id') id: string, @Param('triggerId') triggerId: string, @Req() req: any, @Body() dto: Partial<CreateTriggerDto>) {
    return this.templateService.updateTrigger(orgId, id, triggerId, req.user.id, dto)
  }

  @Delete(':id/triggers/:triggerId')
  deleteTrigger(@Param('orgId') orgId: string, @Param('id') id: string, @Param('triggerId') triggerId: string, @Req() req: any) {
    return this.templateService.deleteTrigger(orgId, id, triggerId, req.user.id)
  }

  // ── Access ───────────────────────────────────────────────────────────────────

  @Get(':id/access')
  listAccess(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.templateService.listAccess(orgId, id)
  }

  @Post(':id/access')
  grantAccess(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any, @Body() dto: { user_id: string; access_type: string }) {
    return this.templateService.grantAccess(orgId, id, req.user.id, dto)
  }

  @Delete(':id/access/:userId')
  revokeAccess(@Param('orgId') orgId: string, @Param('id') id: string, @Param('userId') targetUserId: string, @Req() req: any) {
    return this.templateService.revokeAccess(orgId, id, req.user.id, targetUserId)
  }

  // ── Instances ────────────────────────────────────────────────────────────────

  @Post(':id/instances/trigger')
  async triggerInstance(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any, @Body() dto: TriggerInstanceDto) {
    await this.templateService.assertCanTrigger(orgId, id, req.user.id)
    return this.engineService.createInstance(id, 'manual_trigger', { name: dto.name }, req.user.id)
  }

  @Get(':id/instances')
  listInstances(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.templateService.listInstances(orgId, id)
  }

  @Get(':id/instances/:iid')
  getInstance(@Param('orgId') orgId: string, @Param('id') id: string, @Param('iid') iid: string) {
    return this.templateService.getInstance(orgId, id, iid)
  }

  @Get(':id/instances/:iid/tasks')
  getInstanceTasks(@Param('orgId') orgId: string, @Param('iid') iid: string) {
    return this.templateService.getInstanceTasks(orgId, iid)
  }

  @Post(':id/instances/:iid/cancel')
  cancelInstance(@Param('orgId') orgId: string, @Param('id') id: string, @Req() req: any, @Param('iid') iid: string) {
    return this.templateService.cancelInstance(orgId, id, req.user.id, iid)
  }
}
