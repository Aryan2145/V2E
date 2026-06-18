import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionAction } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ACCESS_RIGHTS_RESOURCE } from './access-rights.constants';
import { AccessRightsService } from './access-rights.service';
import { UpdateAccessRightsDto } from './dto/update-access-rights.dto';

@ApiTags('access-rights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard, PermissionsGuard)
@Controller('api/v1/org/:orgId/access-rights')
export class AccessRightsController {
  constructor(private readonly service: AccessRightsService) {}

  @Get()
  @RequirePermission(ACCESS_RIGHTS_RESOURCE, PermissionAction.read)
  @ApiOperation({ summary: 'Get the full access-rights matrix' })
  getMatrix(@Param('orgId') orgId: string) {
    return this.service.getMatrix(orgId);
  }

  @Put()
  @RequirePermission(ACCESS_RIGHTS_RESOURCE, PermissionAction.edit)
  @ApiOperation({ summary: 'Bulk update access-rights (manage access rights meta-permission)' })
  update(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Body() dto: UpdateAccessRightsDto,
  ) {
    return this.service.updateMatrix(orgId, req.user.id, dto);
  }

  @Get('me')
  @ApiOperation({ summary: "Current user's own permissions across resources (for UI gating)" })
  getMine(@Param('orgId') orgId: string, @Request() req: any) {
    return this.service.getMyPermissions(orgId, req.user.role ?? null, !!req.user.isSuperAdmin);
  }
}
