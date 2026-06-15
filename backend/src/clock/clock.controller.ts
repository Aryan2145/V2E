import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { ClockService } from './clock.service';
import { ReplayService } from './replay.service';

class SetClockDto {
  // Decorator required: the global ValidationPipe runs with whitelist:true and
  // strips any property that has no class-validator decorator.
  @IsDateString()
  datetime: string; // ISO string for the simulated instant
}

@ApiTags('clock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/clock')
export class ClockController {
  constructor(
    private readonly clock: ClockService,
    private readonly replay: ReplayService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the simulated clock state for an organization' })
  getState(@Param('orgId') orgId: string) {
    return this.clock.getState(orgId);
  }

  @Post('set')
  @ApiOperation({ summary: 'Set (jump) the simulated clock for a test organization' })
  async set(@Param('orgId') orgId: string, @Body() dto: SetClockDto) {
    const state = await this.clock.setClock(orgId, dto.datetime);
    // Replay every day in the gap so "what would have happened" actually happens.
    await this.replay.catchUp(orgId);
    return this.clock.getState(orgId).then((s) => ({ ...s, replayed: true })).catch(() => state);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset the simulated clock back to real time' })
  reset(@Param('orgId') orgId: string) {
    return this.clock.resetClock(orgId);
  }
}
