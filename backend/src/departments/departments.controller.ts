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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { RequireAdmin } from '../common/decorators/require-admin.decorator';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

class UpdatePositionDto {
  x: number;
  y: number;
}

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all departments in the organization' })
  findAll(@Param('orgId') orgId: string) {
    return this.departmentsService.findAll(orgId);
  }

  @Post()
  @RequireAdmin()
  @ApiOperation({ summary: 'Create a new department' })
  create(@Param('orgId') orgId: string, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(orgId, dto);
  }

  @Patch(':id')
  @RequireAdmin()
  @ApiOperation({ summary: 'Update a department' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, orgId, dto);
  }

  @Patch(':id/position')
  @RequireAdmin()
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
  @RequireAdmin()
  @ApiOperation({ summary: 'Delete a department' })
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.departmentsService.remove(id, orgId);
  }
}
