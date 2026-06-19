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
import { PermissionAction } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequireAdmin } from '../common/decorators/require-admin.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { BulletinService } from './bulletin.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { CreateBulletinPostDto } from './dto/create-post.dto';
import { CreateBulletinCommentDto } from './dto/create-comment.dto';

@ApiTags('bulletin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard, PermissionsGuard)
@Controller('api/v1/org/:orgId/bulletin')
export class BulletinController {
  constructor(private readonly service: BulletinService) {}

  // ─── Boards ────────────────────────────────────────────────────────────────

  @Get('boards')
  @ApiOperation({ summary: 'List all bulletin boards' })
  findAllBoards(@Param('orgId') orgId: string) {
    return this.service.findAllBoards(orgId);
  }

  @Get('boards/:boardId')
  @ApiOperation({ summary: 'Get a bulletin board' })
  findBoard(@Param('orgId') orgId: string, @Param('boardId') boardId: string) {
    return this.service.findBoard(boardId, orgId);
  }

  @Post('boards')
  @RequirePermission('communication.bulletin.manage', PermissionAction.write)
  @ApiOperation({ summary: 'Create a bulletin board' })
  createBoard(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Body() dto: CreateBoardDto,
  ) {
    return this.service.createBoard(orgId, req.user.id, dto);
  }

  @Patch('boards/:boardId')
  @RequirePermission('communication.bulletin.manage', PermissionAction.edit)
  @ApiOperation({ summary: 'Update a bulletin board' })
  updateBoard(
    @Param('orgId') orgId: string,
    @Param('boardId') boardId: string,
    @Body() dto: Partial<CreateBoardDto>,
  ) {
    return this.service.updateBoard(boardId, orgId, dto);
  }

  @Delete('boards/:boardId')
  @RequireAdmin()
  @ApiOperation({ summary: 'Deactivate a bulletin board' })
  deleteBoard(@Param('orgId') orgId: string, @Param('boardId') boardId: string) {
    return this.service.deleteBoard(boardId, orgId);
  }

  // ─── Posts ─────────────────────────────────────────────────────────────────

  @Get('boards/:boardId/posts')
  @ApiOperation({ summary: 'List posts on a board' })
  findPosts(@Param('orgId') orgId: string, @Param('boardId') boardId: string) {
    return this.service.findPosts(boardId, orgId);
  }

  @Get('boards/:boardId/posts/:postId')
  @ApiOperation({ summary: 'Get a post with comments and reactions' })
  findPost(
    @Param('orgId') orgId: string,
    @Param('boardId') boardId: string,
    @Param('postId') postId: string,
  ) {
    return this.service.findPost(postId, boardId, orgId);
  }

  @Post('boards/:boardId/posts')
  @ApiOperation({ summary: 'Create a post on a board' })
  createPost(
    @Param('orgId') orgId: string,
    @Param('boardId') boardId: string,
    @Request() req: any,
    @Body() dto: CreateBulletinPostDto,
  ) {
    return this.service.createPost(boardId, orgId, req.user.id, dto);
  }

  @Patch('boards/:boardId/posts/:postId')
  @ApiOperation({ summary: 'Update a post' })
  updatePost(
    @Param('orgId') orgId: string,
    @Param('boardId') boardId: string,
    @Param('postId') postId: string,
    @Request() req: any,
    @Body() dto: Partial<CreateBulletinPostDto>,
  ) {
    return this.service.updatePost(postId, boardId, orgId, req.user.id, dto);
  }

  @Delete('boards/:boardId/posts/:postId')
  @ApiOperation({ summary: 'Delete a post' })
  deletePost(
    @Param('orgId') orgId: string,
    @Param('boardId') boardId: string,
    @Param('postId') postId: string,
    @Request() req: any,
  ) {
    return this.service.deletePost(postId, boardId, orgId, req.user.id, !!req.user.is_admin);
  }

  @Post('boards/:boardId/posts/:postId/pin')
  @RequirePermission('communication.bulletin.manage', PermissionAction.write)
  @ApiOperation({ summary: 'Toggle pin on a post' })
  togglePin(
    @Param('orgId') orgId: string,
    @Param('boardId') boardId: string,
    @Param('postId') postId: string,
  ) {
    return this.service.togglePin(postId, boardId, orgId);
  }

  // ─── Comments ──────────────────────────────────────────────────────────────

  @Post('boards/:boardId/posts/:postId/comments')
  @ApiOperation({ summary: 'Add a comment to a post' })
  addComment(
    @Param('orgId') orgId: string,
    @Param('postId') postId: string,
    @Request() req: any,
    @Body() dto: CreateBulletinCommentDto,
  ) {
    return this.service.addComment(postId, orgId, req.user.id, dto);
  }

  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Delete a comment' })
  deleteComment(
    @Param('orgId') orgId: string,
    @Param('commentId') commentId: string,
    @Request() req: any,
  ) {
    return this.service.deleteComment(commentId, orgId, req.user.id, !!req.user.is_admin);
  }

  // ─── Reactions ─────────────────────────────────────────────────────────────

  @Post('boards/:boardId/posts/:postId/react')
  @ApiOperation({ summary: 'Toggle a reaction on a post' })
  toggleReaction(
    @Param('orgId') orgId: string,
    @Param('postId') postId: string,
    @Request() req: any,
    @Body('emoji') emoji: string,
  ) {
    return this.service.toggleReaction(postId, orgId, req.user.id, emoji);
  }

  @Get('boards/:boardId/posts/:postId/reactions')
  @ApiOperation({ summary: 'Get grouped reactions for a post' })
  getReactions(@Param('orgId') orgId: string, @Param('postId') postId: string) {
    return this.service.getReactions(postId, orgId);
  }
}
