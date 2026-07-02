import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto/send-message.dto';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private readonly messagingService: MessagingService) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId as string;
    if (userId) client.data.userId = userId;
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { convId: string; orgId: string },
  ) {
    const userId = client.data.userId as string;
    if (!userId) return { error: 'unauthenticated' };
    // Only conversation members may subscribe to the room — otherwise any socket
    // could receive every future broadcast for a conversation it can't read.
    try {
      await this.messagingService.getConversation(payload.convId, userId, payload.orgId);
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
    @MessageBody() payload: { convId: string; orgId: string; dto: SendMessageDto },
  ) {
    const userId = client.data.userId as string;
    if (!userId) return;
    const message = await this.messagingService.sendMessage(
      payload.convId,
      userId,
      payload.orgId,
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
    client.to(`conv:${payload.convId}`).emit('typing', {
      userId: client.data.userId,
      userName: payload.userName,
      isTyping: payload.isTyping,
    });
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { convId: string; orgId: string; msgId: string; body: string },
  ) {
    const userId = client.data.userId as string;
    if (!userId) return;
    const message = await this.messagingService.editMessage(
      payload.msgId,
      payload.convId,
      userId,
      payload.orgId,
      payload.body,
    );
    this.server.to(`conv:${payload.convId}`).emit('messageEdited', message);
    return message;
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { convId: string; orgId: string; msgId: string },
  ) {
    const userId = client.data.userId as string;
    if (!userId) return;
    await this.messagingService.deleteMessage(
      payload.msgId,
      payload.convId,
      userId,
      payload.orgId,
    );
    this.server.to(`conv:${payload.convId}`).emit('messageDeleted', { msgId: payload.msgId });
  }

  emitNewMessage(convId: string, message: any) {
    this.server.to(`conv:${convId}`).emit('newMessage', message);
  }
}
