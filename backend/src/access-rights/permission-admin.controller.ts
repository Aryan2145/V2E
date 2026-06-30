import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireAdmin } from '../common/decorators/require-admin.decorator';
import { PermissionAdminService } from './permission-admin.service';
import { Principal } from './permissions.service';
import {
  CreateSystemRoleDto,
  SetModuleScopeDto,
  SetUserOverrideDto,
  SetUserSubjectOverrideDto,
  UpdateRolePermissionsDto,
  UpdateSystemRoleDto,
  UpdateSubjectPoliciesDto,
} from './dto/permission-admin.dto';

const principalOf = (req: any): Principal => ({
  userId: req.user.id,
  systemRoleId: req.user.system_role_id ?? null,
  isAdmin: !!req.user.is_admin,
  isSuperAdmin: !!req.user.isSuperAdmin,
});

@ApiTags('permission-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard)
@Controller('api/v1/org/:orgId')
export class PermissionAdminController {
  constructor(private readonly service: PermissionAdminService) {}

  // ─── Registry + JobRole matrix (admin) ──────────────────────────────────────

  @Get('permission-registry')
  @RequireAdmin()
  @ApiOperation({ summary: 'The module → sub-module → feature permission tree' })
  getRegistry(@Param('orgId') orgId: string) {
    return this.service.getRegistry(orgId);
  }

  @Get('role-permissions')
  @RequireAdmin()
  @ApiOperation({ summary: 'System Role × feature-leaf permission matrix (+ scope cascade)' })
  getRoleMatrix(@Param('orgId') orgId: string) {
    return this.service.getRoleMatrix(orgId);
  }

  @Put('role-permissions')
  @RequireAdmin()
  @ApiOperation({ summary: 'Bulk update System Role feature permissions' })
  updateRoleMatrix(@Param('orgId') orgId: string, @Request() req: any, @Body() dto: UpdateRolePermissionsDto) {
    return this.service.updateRoleMatrix(orgId, req.user.id, dto.entries);
  }

  // ─── System Role CRUD + module-scope cascade (admin) ────────────────────────

  @Get('system-roles')
  @ApiOperation({ summary: 'Lightweight System Role list (for pickers); any member' })
  listSystemRoles(@Param('orgId') orgId: string) {
    return this.service.listSystemRoles(orgId);
  }

  @Post('system-roles')
  @RequireAdmin()
  @ApiOperation({ summary: 'Create a new System Role' })
  createSystemRole(@Param('orgId') orgId: string, @Request() req: any, @Body() dto: CreateSystemRoleDto) {
    return this.service.createSystemRole(orgId, req.user.id, dto);
  }

  @Patch('system-roles/:roleId')
  @RequireAdmin()
  @ApiOperation({ summary: 'Rename / describe / set default scope of a System Role' })
  updateSystemRole(
    @Param('orgId') orgId: string,
    @Param('roleId') roleId: string,
    @Request() req: any,
    @Body() dto: UpdateSystemRoleDto,
  ) {
    return this.service.updateSystemRole(orgId, req.user.id, roleId, dto);
  }

  @Delete('system-roles/:roleId')
  @RequireAdmin()
  @ApiOperation({ summary: 'Delete a System Role (assigned employees fall back to none)' })
  deleteSystemRole(@Param('orgId') orgId: string, @Param('roleId') roleId: string, @Request() req: any) {
    return this.service.deleteSystemRole(orgId, req.user.id, roleId);
  }

  @Put('system-roles/:roleId/module-scope')
  @RequireAdmin()
  @ApiOperation({ summary: 'Set or clear a module-tier data-scope override' })
  setModuleScope(
    @Param('orgId') orgId: string,
    @Param('roleId') roleId: string,
    @Request() req: any,
    @Body() dto: SetModuleScopeDto,
  ) {
    return this.service.setModuleScope(orgId, req.user.id, roleId, dto.module_key, dto.scope ?? null);
  }

  // ─── Subject eligibility org defaults (admin) ───────────────────────────────

  @Get('subject-policies')
  @RequireAdmin()
  getSubjectPolicies(@Param('orgId') orgId: string) {
    return this.service.getSubjectPolicies(orgId);
  }

  @Put('subject-policies')
  @RequireAdmin()
  updateSubjectPolicies(@Param('orgId') orgId: string, @Request() req: any, @Body() dto: UpdateSubjectPoliciesDto) {
    return this.service.updateSubjectPolicies(orgId, req.user.id, dto.entries);
  }

  // ─── Per-user overrides (admin) ─────────────────────────────────────────────

  @Get('users/:userId/permissions')
  @RequireAdmin()
  @ApiOperation({ summary: 'A user’s inherited + override + effective permissions' })
  getUserPermissions(@Param('orgId') orgId: string, @Param('userId') userId: string) {
    return this.service.getUserPermissions(orgId, userId);
  }

  @Put('users/:userId/overrides')
  @RequireAdmin()
  @ApiOperation({ summary: 'Set or clear a per-user actor permission delta' })
  setUserOverride(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Request() req: any,
    @Body() dto: SetUserOverrideDto,
  ) {
    return this.service.setUserOverride(orgId, req.user.id, userId, dto.feature_key, dto.action, dto.effect ?? null, dto.scope ?? null, dto.reason);
  }

  @Put('users/:userId/subject-overrides')
  @RequireAdmin()
  @ApiOperation({ summary: 'Set or clear a per-user subject-eligibility delta' })
  setUserSubjectOverride(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Request() req: any,
    @Body() dto: SetUserSubjectOverrideDto,
  ) {
    return this.service.setUserSubjectOverride(orgId, req.user.id, userId, dto.subject_key, dto.effect ?? null, dto.reason);
  }

  // ─── Effective permissions for the current user (any member, for UI gating) ─

  @Get('my-permissions')
  @ApiOperation({ summary: 'The current user’s effective leaf permissions' })
  getMyPermissions(@Param('orgId') orgId: string, @Request() req: any) {
    return this.service.getMyEffective(orgId, principalOf(req));
  }
}
