import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { LearningService } from './learning.service';
import { CreateLearningPathDto } from './dto/create-learning-path.dto';
import { UpdateLearningPathDto } from './dto/update-learning-path.dto';
import { CreateLearningItemDto } from './dto/create-learning-item.dto';
import { UpdateLearningItemDto } from './dto/update-learning-item.dto';
import { AssignPathDto } from './dto/assign-path.dto';
import { CompleteItemDto } from './dto/complete-item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';

@ApiTags('learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  // ─── Paths (HR/Admin) ───────────────────────────────────────────────────────

  @Get('paths')
  @ApiOperation({ summary: 'List all learning paths' })
  findAllPaths(@Param('orgId') orgId: string) {
    return this.learningService.findAllPaths(orgId);
  }

  @Get('paths/:pathId')
  @ApiOperation({ summary: 'Get a learning path by ID' })
  findOnePath(
    @Param('orgId') orgId: string,
    @Param('pathId') pathId: string,
  ) {
    return this.learningService.findOnePath(pathId, orgId);
  }

  @Post('paths')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Create a new learning path' })
  createPath(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Body() dto: CreateLearningPathDto,
  ) {
    return this.learningService.createPath(orgId, req.user.id, dto);
  }

  @Patch('paths/:pathId')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Update a learning path' })
  updatePath(
    @Param('orgId') orgId: string,
    @Param('pathId') pathId: string,
    @Body() dto: UpdateLearningPathDto,
  ) {
    return this.learningService.updatePath(pathId, orgId, dto);
  }

  @Post('paths/:pathId/publish')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Publish a learning path (triggers auto-assignment)' })
  publishPath(
    @Param('orgId') orgId: string,
    @Param('pathId') pathId: string,
    @Request() req: any,
  ) {
    return this.learningService.publishPath(pathId, orgId, req.user.id);
  }

  @Post('paths/:pathId/archive')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Archive a learning path' })
  archivePath(
    @Param('orgId') orgId: string,
    @Param('pathId') pathId: string,
  ) {
    return this.learningService.archivePath(pathId, orgId);
  }

  @Delete('paths/:pathId')
  @Roles('org_admin')
  @ApiOperation({ summary: 'Delete a learning path' })
  deletePath(
    @Param('orgId') orgId: string,
    @Param('pathId') pathId: string,
  ) {
    return this.learningService.deletePath(pathId, orgId);
  }

  // ─── Items ──────────────────────────────────────────────────────────────────

  @Post('paths/:pathId/items')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Add a learning item to a path' })
  addItem(
    @Param('orgId') orgId: string,
    @Param('pathId') pathId: string,
    @Body() dto: CreateLearningItemDto,
  ) {
    return this.learningService.addItem(pathId, orgId, dto);
  }

  @Patch('paths/:pathId/items/:itemId')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Update a learning item' })
  updateItem(
    @Param('orgId') orgId: string,
    @Param('pathId') pathId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateLearningItemDto,
  ) {
    return this.learningService.updateItem(pathId, itemId, orgId, dto);
  }

  @Delete('paths/:pathId/items/:itemId')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Delete a learning item' })
  deleteItem(
    @Param('orgId') orgId: string,
    @Param('pathId') pathId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.learningService.deleteItem(pathId, itemId, orgId);
  }

  @Patch('paths/:pathId/items/reorder')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Reorder items in a learning path' })
  reorderItems(
    @Param('orgId') orgId: string,
    @Param('pathId') pathId: string,
    @Body() dto: ReorderItemsDto,
  ) {
    return this.learningService.reorderItems(pathId, orgId, dto);
  }

  // ─── Assignments ─────────────────────────────────────────────────────────────

  @Post('paths/:pathId/assign')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Assign a learning path to employees' })
  assignPath(
    @Param('orgId') orgId: string,
    @Param('pathId') pathId: string,
    @Request() req: any,
    @Body() dto: AssignPathDto,
  ) {
    return this.learningService.assignPath(pathId, orgId, req.user.id, dto);
  }

  @Get('paths/:pathId/assignments')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Get all assignments for a learning path' })
  getAssignments(
    @Param('orgId') orgId: string,
    @Param('pathId') pathId: string,
  ) {
    return this.learningService.getAssignments(pathId, orgId);
  }

  // ─── Progress Dashboard (HR) ─────────────────────────────────────────────────

  @Get('progress')
  @Roles('org_admin', 'hr_manager')
  @ApiOperation({ summary: 'Get org-wide learning progress summary' })
  getOrgProgress(@Param('orgId') orgId: string) {
    return this.learningService.getOrgProgress(orgId);
  }

  // ─── Employee: My Learning ──────────────────────────────────────────────────

  @Get('my')
  @ApiOperation({ summary: 'Get my assigned learning paths' })
  getMyAssignments(@Request() req: any) {
    const profileId = req.user.employee_profile_id;
    if (!profileId) return [];
    return this.learningService.getMyAssignments(profileId);
  }

  @Get('my/:assignmentId')
  @ApiOperation({ summary: 'Get a specific assignment with items and progress' })
  getMyAssignment(
    @Param('assignmentId') assignmentId: string,
    @Request() req: any,
  ) {
    const profileId = req.user.employee_profile_id;
    return this.learningService.getMyAssignment(assignmentId, profileId);
  }

  @Post('my/:assignmentId/items/:itemId/complete')
  @ApiOperation({ summary: 'Mark a learning item as complete' })
  completeItem(
    @Param('assignmentId') assignmentId: string,
    @Param('itemId') itemId: string,
    @Request() req: any,
    @Body() dto: CompleteItemDto,
  ) {
    const profileId = req.user.employee_profile_id;
    return this.learningService.completeItem(assignmentId, itemId, profileId, dto);
  }
}
