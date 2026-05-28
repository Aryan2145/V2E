import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyPoliciesService } from './company-policies.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { CreatePolicyItemDto } from './dto/create-policy-item.dto';
import { UpdatePolicyItemDto } from './dto/update-policy-item.dto';
import { AssignPolicyDto } from './dto/assign-policy.dto';

@ApiTags('ecs-policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/ecs/policies')
export class CompanyPoliciesController {
  constructor(private readonly service: CompanyPoliciesService) {}

  @Get()
  @ApiOperation({ summary: 'List all company policies' })
  findAll(@Param('orgId') orgId: string) {
    return this.service.findAll(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a company policy with items' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.findOne(id, orgId);
  }

  @Post()
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Create a company policy' })
  create(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePolicyDto,
  ) {
    return this.service.create(orgId, userId, dto);
  }

  @Patch(':id')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Update a company policy' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.service.update(id, orgId, dto);
  }

  @Post(':id/publish')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Publish a company policy' })
  publish(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.publish(id, orgId);
  }

  @Post(':id/archive')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Archive a company policy' })
  archive(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.archive(id, orgId);
  }

  @Delete(':id')
  @Roles('org_admin')
  @ApiOperation({ summary: 'Delete a company policy' })
  delete(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.delete(id, orgId);
  }

  @Post(':id/items')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Add an item to a policy' })
  addItem(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: CreatePolicyItemDto,
  ) {
    return this.service.addItem(id, orgId, dto);
  }

  @Patch(':id/items/:itemId')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Update a policy item' })
  updateItem(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePolicyItemDto,
  ) {
    return this.service.updateItem(id, itemId, orgId, dto);
  }

  @Delete(':id/items/:itemId')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Delete a policy item' })
  deleteItem(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.deleteItem(id, itemId, orgId);
  }

  @Post(':id/assign')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Assign policy to employees' })
  assign(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AssignPolicyDto,
  ) {
    return this.service.assignPolicy(id, orgId, userId, dto);
  }

  @Get(':id/assignments')
  @ApiOperation({ summary: 'Get assignments for a policy' })
  getAssignments(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getAssignments(id, orgId);
  }
}
