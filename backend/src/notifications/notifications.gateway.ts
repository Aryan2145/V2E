import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Real-time notification channel. Each connected client joins a room for its
 * user id (from handshake auth, same pattern as the chat gateway), and the
 * NotificationsService emits to `user:{id}` rooms.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/notifications' })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId as string;
    if (userId) {
      client.data.userId = userId;
      client.join(`user:${userId}`);
    }
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
