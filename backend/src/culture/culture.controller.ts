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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CultureService } from './culture.service';
import { CreateCultureStandardDto } from './dto/create-culture-standard.dto';
import { UpdateCultureStandardDto } from './dto/update-culture-standard.dto';

@ApiTags('Culture')
@ApiBearerAuth()
@Controller('api/v1/org/:orgId/culture')
export class CultureController {
  constructor(private readonly cultureService: CultureService) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrgScopeGuard)
  @ApiOperation({ summary: 'Get all culture standards grouped by type' })
  @ApiParam({ name: 'orgId', type: String })
  findAll(@Param('orgId') orgId: string) {
    return this.cultureService.findAll(orgId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard)
  @Roles(UserRole.org_admin, UserRole.hr_manager)
  @ApiOperation({ summary: 'Create a culture standard' })
  @ApiParam({ name: 'orgId', type: String })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateCultureStandardDto,
  ) {
    return this.cultureService.create(orgId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard)
  @Roles(UserRole.org_admin, UserRole.hr_manager)
  @ApiOperation({ summary: 'Update a culture standard' })
  @ApiParam({ name: 'orgId', type: String })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCultureStandardDto,
  ) {
    return this.cultureService.update(id, orgId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard)
  @Roles(UserRole.org_admin, UserRole.hr_manager)
  @ApiOperation({ summary: 'Delete a culture standard' })
  @ApiParam({ name: 'orgId', type: String })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.cultureService.remove(id, orgId);
  }
}
