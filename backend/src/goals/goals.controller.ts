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
import { GoalLevel, GoalPerspective, PermissionAction } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto, DeleteGoalDto } from './dto/update-goal.dto';

const GOALS = 'goals';

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard, PermissionsGuard)
@Controller('api/v1/org/:orgId/goals')
export class GoalsController {
  constructor(private readonly service: GoalsService) {}

  @Get()
  @RequirePermission(GOALS, PermissionAction.read)
  @ApiOperation({ summary: 'List goals with filters' })
  list(
    @Param('orgId') orgId: string,
    @Query('level') level?: GoalLevel,
    @Query('perspective') perspective?: GoalPerspective,
    @Query('owner_user_id') owner_user_id?: string,
    @Query('parent_goal_id') parent_goal_id?: string,
    @Query('status') status?: string,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
    @Query('search') search?: string,
  ) {
    return this.service.list(orgId, {
      level,
      perspective,
      owner_user_id,
      parent_goal_id,
      status,
      from_date,
      to_date,
      search,
    });
  }

  @Get('scorecard')
  @RequirePermission(GOALS, PermissionAction.read)
  @ApiOperation({ summary: 'Balanced Scorecard rollup over annual goals' })
  scorecard(@Param('orgId') orgId: string) {
    return this.service.getScorecard(orgId);
  }

  @Get(':parentId/next-default')
  @RequirePermission(GOALS, PermissionAction.read)
  @ApiOperation({ summary: 'Smart default due date for the next child under a parent' })
  nextDefault(@Param('orgId') orgId: string, @Param('parentId') parentId: string) {
    return this.service.getNextDefault(orgId, parentId);
  }

  @Get(':id')
  @RequirePermission(GOALS, PermissionAction.read)
  @ApiOperation({ summary: 'Goal detail (parent, children, measures, linked tasks)' })
  getOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getOne(orgId, id);
  }

  @Post()
  @RequirePermission(GOALS, PermissionAction.write)
  @ApiOperation({ summary: 'Create a goal' })
  create(@Param('orgId') orgId: string, @Request() req: any, @Body() dto: CreateGoalDto) {
    return this.service.create(orgId, req.user.id, dto);
  }

  @Patch(':id')
  @RequirePermission(GOALS, PermissionAction.edit)
  @ApiOperation({ summary: 'Update a goal' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.service.update(orgId, req.user.id, id, dto);
  }

  @Delete(':id')
  @RequirePermission(GOALS, PermissionAction.delete)
  @ApiOperation({ summary: 'Soft-delete a goal (blocked if it has children)' })
  remove(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: DeleteGoalDto,
  ) {
    return this.service.remove(orgId, req.user.id, id, dto?.reason);
  }
}
