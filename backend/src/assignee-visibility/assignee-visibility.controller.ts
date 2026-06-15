import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { AssigneeVisibilityService } from './assignee-visibility.service';
import {
  CreateBridgeDto,
  CreateExceptionDto,
  SetDeptUpwardDto,
  UpdateAssigneeSettingsDto,
} from './dto/assignee-visibility.dto';

@ApiTags('assignee-visibility')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/tasks/masters/assignee-visibility')
export class AssigneeVisibilityController {
  constructor(private readonly service: AssigneeVisibilityService) {}

  @Get()
  @ApiOperation({ summary: 'Full assignee-visibility config (settings, exceptions, bridges, depts)' })
  getAdminView(@Param('orgId') orgId: string) {
    return this.service.getAdminView(orgId);
  }

  @Get('explain')
  @ApiOperation({ summary: "Explain a user's resolved assignee pool and which rule produced it" })
  explain(@Param('orgId') orgId: string, @Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId query parameter is required');
    return this.service.explain(orgId, userId);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update override / excludes / full-visibility / config roles' })
  updateSettings(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Body() dto: UpdateAssigneeSettingsDto,
  ) {
    return this.service.updateSettings(orgId, req.user.id, dto);
  }

  @Post('exceptions')
  @ApiOperation({ summary: 'Create a scoped widen/narrow exception' })
  createException(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Body() dto: CreateExceptionDto,
  ) {
    return this.service.createException(orgId, req.user.id, dto);
  }

  @Delete('exceptions/:id')
  @ApiOperation({ summary: 'Delete an exception' })
  deleteException(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.service.deleteException(orgId, req.user.id, id);
  }

  @Post('bridges')
  @ApiOperation({ summary: 'Create a one-directional cross-department bridge' })
  createBridge(@Param('orgId') orgId: string, @Request() req: any, @Body() dto: CreateBridgeDto) {
    return this.service.createBridge(orgId, req.user.id, dto);
  }

  @Delete('bridges/:id')
  @ApiOperation({ summary: 'Delete a bridge' })
  deleteBridge(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any) {
    return this.service.deleteBridge(orgId, req.user.id, id);
  }

  @Patch('department-upward')
  @ApiOperation({ summary: 'Toggle a department\'s upward-assignment switch' })
  setDepartmentUpward(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Body() dto: SetDeptUpwardDto,
  ) {
    return this.service.setDepartmentUpward(orgId, req.user.id, dto);
  }
}
