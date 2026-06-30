import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsArray, IsOptional, IsString } from 'class-validator';
import { PermissionAction } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

class CreateImportBatchDto {
  @IsOptional()
  @IsString()
  file_name?: string;

  @IsNumber()
  total_rows: number;

  @IsNumber()
  created_count: number;

  @IsNumber()
  failed_count: number;

  @IsArray()
  @IsString({ each: true })
  department_ids: string[];
}

// Managing the department structure is gated by a delegable access right
// (org admins hold it implicitly — see ADMIN_IMPLIED_FEATURE_LEAVES).
const STRUCTURE = 'settings.organization.structure';

class UpdatePositionDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard, PermissionsGuard)
@Controller('api/v1/org/:orgId/departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all departments in the organization' })
  findAll(@Param('orgId') orgId: string) {
    return this.departmentsService.findAll(orgId);
  }

  @Post()
  @RequirePermission(STRUCTURE, PermissionAction.write)
  @ApiOperation({ summary: 'Create a new department' })
  create(@Param('orgId') orgId: string, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(orgId, dto);
  }

  @Patch(':id')
  @RequirePermission(STRUCTURE, PermissionAction.edit)
  @ApiOperation({ summary: 'Update a department' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, orgId, dto);
  }

  @Patch(':id/position')
  @RequirePermission(STRUCTURE, PermissionAction.edit)
  @ApiOperation({ summary: 'Update department canvas position' })
  @ApiBody({ type: UpdatePositionDto })
  updatePosition(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() body: UpdatePositionDto,
  ) {
    return this.departmentsService.updatePosition(id, orgId, body.x, body.y);
  }

  @Delete(':id')
  @RequirePermission(STRUCTURE, PermissionAction.delete)
  @ApiOperation({ summary: 'Delete a department' })
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.departmentsService.remove(id, orgId);
  }

  @Get('imports')
  @RequirePermission(STRUCTURE, PermissionAction.write)
  @ApiOperation({ summary: 'List department import batches' })
  listImports(@Param('orgId') orgId: string) {
    return this.departmentsService.listImportBatches(orgId);
  }

  @Post('imports')
  @RequirePermission(STRUCTURE, PermissionAction.write)
  @ApiOperation({ summary: 'Record a department import batch' })
  createImportBatch(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateImportBatchDto,
  ) {
    return this.departmentsService.createImportBatch(orgId, userId, dto);
  }

  @Post('imports/:batchId/undo')
  @RequirePermission(STRUCTURE, PermissionAction.write)
  @ApiOperation({ summary: 'Undo department import batch' })
  undoImport(
    @Param('orgId') orgId: string,
    @Param('batchId') batchId: string,
  ) {
    return this.departmentsService.undoImport(orgId, batchId);
  }
}
