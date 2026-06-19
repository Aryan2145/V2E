import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmployeeStatus, PermissionAction } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequireAdmin } from '../common/decorators/require-admin.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { BulkImportEmployeesDto } from './dto/bulk-import-employee.dto';

class UpdateStatusDto {
  status: EmployeeStatus;
}

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard, PermissionsGuard)
@Controller('api/v1/org/:orgId/employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'List all employees in the organization' })
  findAll(@Param('orgId') orgId: string) {
    return this.employeesService.findAll(orgId);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get reporting tree for all employees' })
  getReportingTree(@Param('orgId') orgId: string) {
    return this.employeesService.getReportingTree(orgId);
  }

  @Get('people-events')
  @ApiOperation({ summary: 'Get upcoming birthdays, anniversaries, new hirings, and work anniversaries' })
  getPeopleEvents(
    @Param('orgId') orgId: string,
    @Query('window') window?: string,
  ) {
    return this.employeesService.getPeopleEvents(orgId, window ? parseInt(window, 10) : 30);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full employee profile with reporting chain' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.employeesService.findOne(id, orgId);
  }

  @Post()
  @RequirePermission('employees.profile.manage', PermissionAction.write)
  @ApiOperation({ summary: 'Create a new employee (creates user account + profile)' })
  create(@Param('orgId') orgId: string, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(orgId, dto);
  }

  @Post('bulk-import')
  @RequirePermission('employees.profile.manage', PermissionAction.write)
  @ApiOperation({ summary: 'Bulk-create employees from CSV rows (resolved by name/email)' })
  bulkImport(@Param('orgId') orgId: string, @Body() dto: BulkImportEmployeesDto) {
    return this.employeesService.bulkImport(orgId, dto.rows);
  }

  @Patch(':id')
  @RequirePermission('employees.profile.manage', PermissionAction.edit)
  @ApiOperation({ summary: 'Update employee profile fields' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, orgId, dto);
  }

  @Patch(':id/status')
  @RequireAdmin()
  @ApiOperation({ summary: 'Update employee status (active/inactive/on_leave)' })
  @ApiBody({ type: UpdateStatusDto })
  updateStatus(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() body: UpdateStatusDto,
  ) {
    return this.employeesService.updateStatus(id, orgId, body.status);
  }
}
