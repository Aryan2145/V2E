import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { OrgScopeGuard } from '../common/guards/org-scope.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { TicketsService } from './tickets.service'
import { UpdateTicketMasterDto } from './dto/update-ticket-master.dto'
import { CreateTicketTypeDto, UpdateTicketTypeDto } from './dto/create-ticket-type.dto'
import { CreateTicketCategoryDto, UpdateTicketCategoryDto } from './dto/create-ticket-category.dto'
import { CreateTicketPriorityDto, UpdateTicketPriorityDto } from './dto/create-ticket-priority.dto'
import { CreateTicketStatusDto, UpdateTicketStatusDto, ReorderTicketStatusesDto } from './dto/create-ticket-status.dto'
import { CreateTicketTemplateDto, UpdateTicketTemplateDto } from './dto/create-ticket-template.dto'
import { CreateResolverGroupDto, UpdateResolverGroupDto } from './dto/resolver-group.dto'

@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/tickets/masters')
export class TicketsMastersController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('config')
  getConfig(@Param('orgId') orgId: string) {
    return this.ticketsService.getConfig(orgId)
  }

  @Patch('config')
  updateConfig(@Param('orgId') orgId: string, @Body() dto: UpdateTicketMasterDto) {
    return this.ticketsService.updateConfig(orgId, dto)
  }

  @Get('types')
  listTypes(@Param('orgId') orgId: string) {
    return this.ticketsService.listTypes(orgId)
  }

  @Post('types')
  createType(@Param('orgId') orgId: string, @Body() dto: CreateTicketTypeDto) {
    return this.ticketsService.createType(orgId, dto)
  }

  @Patch('types/:id')
  updateType(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateTicketTypeDto) {
    return this.ticketsService.updateType(orgId, id, dto)
  }

  @Delete('types/:id')
  deleteType(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.ticketsService.deleteType(orgId, id)
  }

  @Get('categories')
  listCategories(@Param('orgId') orgId: string) {
    return this.ticketsService.listCategories(orgId)
  }

  @Post('categories')
  createCategory(@Param('orgId') orgId: string, @Body() dto: CreateTicketCategoryDto) {
    return this.ticketsService.createCategory(orgId, dto)
  }

  @Patch('categories/:id')
  updateCategory(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateTicketCategoryDto) {
    return this.ticketsService.updateCategory(orgId, id, dto)
  }

  @Delete('categories/:id')
  deleteCategory(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.ticketsService.deleteCategory(orgId, id)
  }

  @Get('priorities')
  listPriorities(@Param('orgId') orgId: string) {
    return this.ticketsService.listPriorities(orgId)
  }

  @Post('priorities')
  createPriority(@Param('orgId') orgId: string, @Body() dto: CreateTicketPriorityDto) {
    return this.ticketsService.createPriority(orgId, dto)
  }

  @Patch('priorities/:id')
  updatePriority(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateTicketPriorityDto) {
    return this.ticketsService.updatePriority(orgId, id, dto)
  }

  @Delete('priorities/:id')
  deletePriority(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.ticketsService.deletePriority(orgId, id)
  }

  @Get('statuses')
  listStatuses(@Param('orgId') orgId: string) {
    return this.ticketsService.listStatuses(orgId)
  }

  @Post('statuses')
  createStatus(@Param('orgId') orgId: string, @Body() dto: CreateTicketStatusDto) {
    return this.ticketsService.createStatus(orgId, dto)
  }

  @Patch('statuses/reorder')
  reorderStatuses(@Param('orgId') orgId: string, @Body() dto: ReorderTicketStatusesDto) {
    return this.ticketsService.reorderStatuses(orgId, dto)
  }

  @Patch('statuses/:id')
  updateStatus(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.ticketsService.updateStatus(orgId, id, dto)
  }

  @Get('templates')
  listTemplates(@Param('orgId') orgId: string) {
    return this.ticketsService.listTemplates(orgId)
  }

  @Post('templates')
  createTemplate(@Param('orgId') orgId: string, @Body() dto: CreateTicketTemplateDto, @CurrentUser() user: { id: string }) {
    return this.ticketsService.createTemplate(orgId, user.id, dto)
  }

  @Patch('templates/:id')
  updateTemplate(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateTicketTemplateDto) {
    return this.ticketsService.updateTemplate(orgId, id, dto)
  }

  @Delete('templates/:id')
  archiveTemplate(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.ticketsService.archiveTemplate(orgId, id)
  }

  @Get('resolver-groups')
  listResolverGroups(@Param('orgId') orgId: string) {
    return this.ticketsService.listResolverGroups(orgId)
  }

  @Post('resolver-groups')
  createResolverGroup(@Param('orgId') orgId: string, @Body() dto: CreateResolverGroupDto) {
    return this.ticketsService.createResolverGroup(orgId, dto)
  }

  @Patch('resolver-groups/:id')
  updateResolverGroup(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateResolverGroupDto) {
    return this.ticketsService.updateResolverGroup(orgId, id, dto)
  }

  @Delete('resolver-groups/:id')
  deleteResolverGroup(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.ticketsService.deleteResolverGroup(orgId, id)
  }
}
