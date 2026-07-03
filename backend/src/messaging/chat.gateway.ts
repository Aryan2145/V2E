import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto/send-message.dto';
import { WsAuthService } from '../auth/ws-auth.service';

/**
 * Chat channel. Both the acting user id AND the org come from the VERIFIED
 * handshake JWT (see WsAuthService) and are read off `client.data`, never from
 * the message payload. Previously the gateway trusted a client-supplied userId
 * in the handshake and a client-supplied orgId in every message, so anyone could
 * impersonate any user and read/send/edit/delete their chat across orgs
 * (SECURITY_AUDIT C5). Unauthenticated handshakes are refused before connect.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/chat' })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  constructor(
    private readonly messagingService: MessagingService,
    private readonly wsAuth: WsAuthService,
  ) {}

  afterInit(server: Server) {
    // Authenticate at the handshake, before connect. Trusted userId + org are
    // derived from the verified token and stashed on socket.data for every handler.
    server.use(async (socket: Socket, next: (err?: Error) => void) => {
      const principal = await this.wsAuth.authenticate(socket);
      if (!principal) return next(new Error('unauthorized'));
      socket.data.userId = principal.userId;
      socket.data.organizationId = principal.organizationId;
      next();
    });
  }

  handleConnection(client: Socket) {
    // Belt-and-suspenders: the handshake middleware already refused anyone without
    // a verified userId.
    if (!client.data.userId) client.disconnect(true);
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { convId: string },
  ) {
    const userId = client.data.userId as string;
    const orgId = client.data.organizationId as string;
    if (!userId || !orgId) return { error: 'unauthenticated' };
    // Only conversation members may subscribe to the room — otherwise any socket
    // could receive every future broadcast for a conversation it can't read.
    try {
      await this.messagingService.getConversation(payload.convId, userId, orgId);
    } catch {
      return { error: 'forbidden' };
    }
    client.join(`conv:${payload.convId}`);
    return { joined: payload.convId };
  }

  @SubscribeMessage('leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { convId: string },
  ) {
    client.leave(`conv:${payload.convId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { convId: string; dto: SendMessageDto },
  ) {
    const userId = client.data.userId as string;
    const orgId = client.data.organizationId as string;
    if (!userId || !orgId) return;
    const message = await this.messagingService.sendMessage(
      payload.convId,
      userId,
      orgId,
      payload.dto,
    );
    this.server.to(`conv:${payload.convId}`).emit('newMessage', message);
    return message;
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { convId: string; userName: string; isTyping: boolean },
  ) {
    if (!client.data.userId) return;
    client.to(`conv:${payload.convId}`).emit('typing', {
      userId: client.data.userId,
      userName: payload.userName,
      isTyping: payload.isTyping,
    });
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { convId: string; msgId: string; body: string },
  ) {
    const userId = client.data.userId as string;
    const orgId = client.data.organizationId as string;
    if (!userId || !orgId) return;
    const message = await this.messagingService.editMessage(
      payload.msgId,
      payload.convId,
      userId,
      orgId,
      payload.body,
    );
    this.server.to(`conv:${payload.convId}`).emit('messageEdited', message);
    return message;
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { convId: string; msgId: string },
  ) {
    const userId = client.data.userId as string;
    const orgId = client.data.organizationId as string;
    if (!userId || !orgId) return;
    await this.messagingService.deleteMessage(
      payload.msgId,
      payload.convId,
      userId,
      orgId,
    );
    this.server.to(`conv:${payload.convId}`).emit('messageDeleted', { msgId: payload.msgId });
  }

  emitNewMessage(convId: string, message: any) {
    this.server.to(`conv:${convId}`).emit('newMessage', message);
  }
}
