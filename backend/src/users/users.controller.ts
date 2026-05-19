import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
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
  @Roles('org_admin', 'hr_manager')
  findAll(@Param('orgId') orgId: string) {
    return this.usersService.findAll(orgId);
  }

  // Open to all org members — used by the task assignee picker
  @Get('members')
  @UseGuards(OrgScopeGuard)
  findMembers(@Param('orgId') orgId: string) {
    return this.usersService.findMembers(orgId);
  }

  @Post()
  @Roles('org_admin')
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create({ ...dto, organization_id: orgId });
  }

  @Get(':id')
  @UseGuards(OrgScopeGuard)
  @Roles('org_admin', 'hr_manager')
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.usersService.findOne(id, orgId);
  }

  @Patch(':id')
  @Roles('org_admin')
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, orgId, dto);
  }

  @Delete(':id/deactivate')
  @Roles('org_admin')
  deactivate(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.usersService.deactivate(id, orgId);
  }
}
