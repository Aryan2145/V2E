import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataScope } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { principalFromUser } from '../access-rights/permissions.service';
import { TaskCalendarService } from './task-calendar.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/reports/task-calendar')
export class TaskCalendarController {
  constructor(private readonly service: TaskCalendarService) {}

  @Get()
  @ApiOperation({ summary: 'Monthly Task Compliance Calendar for everyone in the viewer’s scope (one row per task+person, one column per day)' })
  getCalendar(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Query('month') month?: string,
    @Query('scope') scope?: DataScope,
  ) {
    return this.service.getCalendar(orgId, principalFromUser(req.user), { month, scope: scope ?? null });
  }
}
