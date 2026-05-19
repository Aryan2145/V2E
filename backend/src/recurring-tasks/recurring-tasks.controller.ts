import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RecurringTasksService } from './recurring-tasks.service';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';

@ApiTags('recurring-tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/org/:orgId/tasks/recurring')
export class RecurringTasksController {
  constructor(private readonly service: RecurringTasksService) {}

  @Get()
  @ApiOperation({ summary: 'List recurring task templates' })
  list(@Param('orgId') orgId: string) {
    return this.service.listTemplates(orgId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a recurring task template' })
  create(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Body() dto: CreateRecurringDto,
  ) {
    return this.service.createTemplate(orgId, req.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a recurring task template' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringDto,
  ) {
    return this.service.updateTemplate(orgId, id, dto);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a recurring task template' })
  pause(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.pauseTemplate(orgId, id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused recurring task template' })
  resume(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.resumeTemplate(orgId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete or stop a recurring task template' })
  remove(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Query('mode') mode?: 'stop' | 'delete-future' | 'delete-all',
  ) {
    return this.service.deleteTemplate(orgId, id, mode ?? 'stop');
  }

  @Get(':id/instances')
  @ApiOperation({ summary: 'Get task instances spawned from a template' })
  getInstances(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getInstances(orgId, id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get completion stats for a recurring template' })
  getStats(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getStats(orgId, id);
  }
}
