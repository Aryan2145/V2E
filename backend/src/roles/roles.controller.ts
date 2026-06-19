import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { RequireAdmin } from '../common/decorators/require-admin.decorator';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List all roles in the organization' })
  @ApiQuery({ name: 'departmentId', required: false })
  findAll(
    @Param('orgId') orgId: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.rolesService.findAll(orgId, departmentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a role by ID' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.rolesService.findOne(id, orgId);
  }

  @Post()
  @RequireAdmin()
  @ApiOperation({ summary: 'Create a new role' })
  create(@Param('orgId') orgId: string, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(orgId, dto);
  }

  @Patch(':id')
  @RequireAdmin()
  @ApiOperation({ summary: 'Update a role' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, orgId, dto);
  }

  @Delete(':id')
  @RequireAdmin()
  @ApiOperation({ summary: 'Delete a role' })
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.rolesService.remove(id, orgId);
  }
}
