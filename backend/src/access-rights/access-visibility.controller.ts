import { BadRequestException, Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { AccessVisibilityService } from './access-visibility.service';
import { principalFromUser } from './permissions.service';

/**
 * Deliberately gated by Jwt + OrgScope ONLY — NOT @RequirePermission. A user who is
 * denied read on a module must still be able to learn WHY (and whether they actually
 * have data there), so the UI can show an honest "hidden by permissions" message
 * instead of a misleading "nothing here, create one" empty state.
 */
@ApiTags('access-visibility')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/access/visibility')
export class AccessVisibilityController {
  constructor(private readonly service: AccessVisibilityService) {}

  @Get(':leaf')
  @ApiOperation({ summary: "Why a module looks empty: can_read, assigned_count, reason" })
  summary(@Param('orgId') orgId: string, @Param('leaf') leaf: string, @Request() req: any) {
    if (!this.service.isScopableLeaf(leaf)) {
      throw new BadRequestException(`Unknown or non-scopable content leaf "${leaf}"`);
    }
    return this.service.summary(orgId, principalFromUser(req.user), leaf);
  }
}
