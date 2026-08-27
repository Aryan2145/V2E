import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataScope } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { principalFromUser } from '../access-rights/permissions.service';
import { TaskAgeingService } from './task-ageing.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/reports/task-ageing')
export class TaskAgeingController {
  constructor(private readonly service: TaskAgeingService) {}

  @Get()
  @ApiOperation({ summary: 'Pending & Overdue Ageing report for everyone in the viewer’s scope (Person-wise + Task-wise + Pending list)' })
  getReport(@Param('orgId') orgId: string, @Request() req: any, @Query('scope') scope?: DataScope) {
    return this.service.getReport(orgId, principalFromUser(req.user), { scope: scope ?? null });
  }
}
