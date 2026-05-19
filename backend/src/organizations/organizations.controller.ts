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
import { SuperAdmin } from '../common/decorators/super-admin.decorator';
import {
  CreateOrgWithAdminDto,
} from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @SuperAdmin()
  findAll() {
    return this.organizationsService.findAll();
  }

  @Post()
  @SuperAdmin()
  create(@Body() dto: CreateOrgWithAdminDto) {
    return this.organizationsService.create(dto);
  }

  @Get(':id')
  @SuperAdmin()
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Patch(':id')
  @SuperAdmin()
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, dto);
  }

  @Delete(':id/deactivate')
  @SuperAdmin()
  deactivate(@Param('id') id: string) {
    return this.organizationsService.deactivate(id);
  }
}
