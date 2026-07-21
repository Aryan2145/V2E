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
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { TimeBlocksService } from './time-blocks.service';
import { CreateTimeBlockDto, UpdateTimeBlockDto } from './dto/time-block.dto';

// Personal Time-Blocks. Org is in the path only to reuse OrgScopeGuard (membership
// check); the data is always the CALLER's own — no permission leaf, since a user
// managing their own availability needs no meetings grant. Every route is scoped
// to req.user.id, so there is no cross-user (IDOR) surface.
@ApiTags('time-blocks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/time-blocks')
export class TimeBlocksController {
  constructor(private readonly service: TimeBlocksService) {}

  @Get()
  @ApiOperation({ summary: "The caller's own time-blocks in a window (imports Google first)" })
  list(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.listMine(orgId, req.user.id, from, to);
  }

  @Post()
  @ApiOperation({ summary: 'Create a personal time-block (mirrors to Google)' })
  create(@Param('orgId') orgId: string, @Request() req: any, @Body() dto: CreateTimeBlockDto) {
    return this.service.create(orgId, req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateTimeBlockDto,
  ) {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Param('orgId') orgId: string, @Param('id') id: string, @Request() req: any) {
    return this.service.remove(req.user.id, id);
  }
}
