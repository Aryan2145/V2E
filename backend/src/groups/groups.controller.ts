import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SuperAdmin } from '../common/decorators/super-admin.decorator';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@ApiTags('groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@SuperAdmin()
@Controller('api/v1/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  findAll() {
    return this.groupsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.groupsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @Post(':id/orgs')
  addOrg(@Param('id') id: string, @Body('org_id') orgId: string) {
    return this.groupsService.addOrg(id, orgId);
  }

  @Delete(':id/orgs/:orgId')
  removeOrg(@Param('id') id: string, @Param('orgId') orgId: string) {
    return this.groupsService.removeOrg(id, orgId);
  }

  @Get(':id/users')
  getGroupUsers(@Param('id') id: string) {
    return this.groupsService.getGroupUsers(id);
  }
}
