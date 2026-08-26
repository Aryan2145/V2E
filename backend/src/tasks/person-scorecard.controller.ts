import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataScope } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { principalFromUser } from '../access-rights/permissions.service';
import { PersonScorecardService } from './person-scorecard.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/reports/person-scorecards')
export class PersonScorecardController {
  constructor(private readonly service: PersonScorecardService) {}

  @Get()
  @ApiOperation({ summary: 'Roster of people the viewer may open, with a headline summary each (scope-aware)' })
  getRoster(@Param('orgId') orgId: string, @Request() req: any, @Query('scope') scope?: DataScope) {
    return this.service.getRoster(orgId, principalFromUser(req.user), scope ?? null);
  }

  // NOTE: `/all` MUST be declared before `/:userId` so it isn't captured as a user id.
  @Get('all')
  @ApiOperation({ summary: 'Full scorecards for every in-scope person — powers "download everyone"' })
  getAll(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Query('scope') scope?: DataScope,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
  ) {
    return this.service.getAllScorecards(orgId, principalFromUser(req.user), { scope: scope ?? null, from_date, to_date });
  }

  @Get(':userId')
  @ApiOperation({ summary: "One person's full scorecard (scope-gated: 403 if outside the viewer's scope)" })
  getOne(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Request() req: any,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
  ) {
    return this.service.getScorecard(orgId, principalFromUser(req.user), userId, { from_date, to_date });
  }
}
