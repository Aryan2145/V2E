import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { OrgScopeGuard } from '../common/guards/org-scope.guard'
import { TicketsService } from './tickets.service'

@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/tickets/reports')
export class TicketsReportsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('resolution-time')
  getResolutionTime(
    @Param('orgId') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ticketsService.getResolutionTimeReport(orgId, from, to)
  }

  @Get('by-type')
  getByType(@Param('orgId') orgId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ticketsService.getBreakdownReport(orgId, 'type', from, to)
  }

  @Get('by-category')
  getByCategory(@Param('orgId') orgId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ticketsService.getBreakdownReport(orgId, 'category', from, to)
  }

  @Get('by-priority')
  getByPriority(@Param('orgId') orgId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ticketsService.getBreakdownReport(orgId, 'priority', from, to)
  }

  @Get('by-status')
  getByStatus(@Param('orgId') orgId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ticketsService.getBreakdownReport(orgId, 'status', from, to)
  }

  @Get('sla-breach')
  getSlaBreaches(@Param('orgId') orgId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ticketsService.getSlaBreachReport(orgId, from, to)
  }

  @Get('ratings')
  getRatings(@Param('orgId') orgId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ticketsService.getRatingsReport(orgId, from, to)
  }
}
