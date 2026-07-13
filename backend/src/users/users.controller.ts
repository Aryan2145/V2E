import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { RequireAdmin } from '../common/decorators/require-admin.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/org/:orgId/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(OrgScopeGuard)
  @RequireAdmin()
  findAll(@Param('orgId') orgId: string) {
    return this.usersService.findAll(orgId);
  }

  // Open to all org members — used by the task assignee picker
  @Get('members')
  @UseGuards(OrgScopeGuard)
  findMembers(@Param('orgId') orgId: string) {
    return this.usersService.findMembers(orgId);
  }

  @Get(':id')
  @UseGuards(OrgScopeGuard)
  @RequireAdmin()
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.usersService.findOne(id, orgId);
  }

  @Patch(':id')
  @UseGuards(OrgScopeGuard)
  @RequireAdmin()
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, orgId, dto);
  }

  @Delete(':id/deactivate')
  @UseGuards(OrgScopeGuard)
  @RequireAdmin()
  deactivate(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.usersService.deactivate(id, orgId);
  }
}
