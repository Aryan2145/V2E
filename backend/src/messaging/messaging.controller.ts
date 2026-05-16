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
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { MessagingService } from './messaging.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/messaging')
export class MessagingController {
  constructor(private readonly service: MessagingService) {}

  // ─── Conversations ─────────────────────────────────────────────────────────

  @Get('conversations')
  @ApiOperation({ summary: 'List my conversations' })
  getConversations(@Param('orgId') orgId: string, @Request() req: any) {
    return this.service.getConversations(req.user.id, orgId);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create or find a conversation' })
  createConversation(
    @Param('orgId') orgId: string,
    @Request() req: any,
    @Body() dto: CreateConversationDto,
  ) {
    return this.service.createConversation(req.user.id, orgId, dto);
  }

  @Get('conversations/:convId')
  @ApiOperation({ summary: 'Get conversation details' })
  getConversation(
    @Param('orgId') orgId: string,
    @Param('convId') convId: string,
    @Request() req: any,
  ) {
    return this.service.getConversation(convId, req.user.id, orgId);
  }

  @Post('conversations/:convId/members')
  @ApiOperation({ summary: 'Add members to a conversation' })
  addMembers(
    @Param('orgId') orgId: string,
    @Param('convId') convId: string,
    @Request() req: any,
    @Body('user_ids') userIds: string[],
  ) {
    return this.service.addMembers(convId, req.user.id, orgId, userIds);
  }

  @Delete('conversations/:convId/members/:targetUserId')
  @ApiOperation({ summary: 'Remove a member from a conversation' })
  removeMember(
    @Param('orgId') orgId: string,
    @Param('convId') convId: string,
    @Param('targetUserId') targetUserId: string,
    @Request() req: any,
  ) {
    return this.service.removeMember(convId, req.user.id, orgId, targetUserId);
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  @Get('conversations/:convId/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  getMessages(
    @Param('orgId') orgId: string,
    @Param('convId') convId: string,
    @Request() req: any,
    @Query('cursor') cursor?: string,
  ) {
    return this.service.getMessages(convId, req.user.id, orgId, cursor);
  }

  @Post('conversations/:convId/messages')
  @ApiOperation({ summary: 'Send a message' })
  sendMessage(
    @Param('orgId') orgId: string,
    @Param('convId') convId: string,
    @Request() req: any,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendMessage(convId, req.user.id, orgId, dto);
  }

  @Patch('conversations/:convId/messages/:msgId')
  @ApiOperation({ summary: 'Edit a message' })
  editMessage(
    @Param('orgId') orgId: string,
    @Param('convId') convId: string,
    @Param('msgId') msgId: string,
    @Request() req: any,
    @Body('body') body: string,
  ) {
    return this.service.editMessage(msgId, convId, req.user.id, orgId, body);
  }

  @Delete('conversations/:convId/messages/:msgId')
  @ApiOperation({ summary: 'Delete (soft) a message' })
  deleteMessage(
    @Param('orgId') orgId: string,
    @Param('convId') convId: string,
    @Param('msgId') msgId: string,
    @Request() req: any,
  ) {
    return this.service.deleteMessage(msgId, convId, req.user.id, orgId, req.user.role);
  }

  @Post('conversations/:convId/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  markRead(
    @Param('orgId') orgId: string,
    @Param('convId') convId: string,
    @Request() req: any,
  ) {
    return this.service.markRead(convId, req.user.id, orgId);
  }
}
