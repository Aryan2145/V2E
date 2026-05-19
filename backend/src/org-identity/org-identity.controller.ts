import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrgIdentityService } from './org-identity.service';
import { UpsertOrgIdentityDto } from './dto/upsert-org-identity.dto';

@ApiTags('Org Identity')
@ApiBearerAuth()
@Controller('api/v1/org/:orgId/identity')
export class OrgIdentityController {
  constructor(private readonly orgIdentityService: OrgIdentityService) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrgScopeGuard)
  @ApiOperation({ summary: 'Get org identity' })
  @ApiParam({ name: 'orgId', type: String })
  findByOrg(@Param('orgId') orgId: string) {
    return this.orgIdentityService.findByOrg(orgId);
  }

  @Put()
  @UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard)
  @Roles(MemberRole.org_admin, MemberRole.hr_manager)
  @ApiOperation({ summary: 'Upsert org identity' })
  @ApiParam({ name: 'orgId', type: String })
  upsert(
    @Param('orgId') orgId: string,
    @Body() dto: UpsertOrgIdentityDto,
  ) {
    return this.orgIdentityService.upsert(orgId, dto);
  }
}
