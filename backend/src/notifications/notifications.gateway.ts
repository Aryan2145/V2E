import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../auth/ws-auth.service';

/**
 * Real-time notification channel. Each connected client joins a room for its
 * user id and the NotificationsService emits to `user:{id}` rooms.
 *
 * The user id is taken from the VERIFIED handshake JWT (see WsAuthService), never
 * from client-supplied handshake fields — previously any party could open a
 * socket, claim any user's id, and receive that user's live notifications
 * (SECURITY_AUDIT C4). Unauthenticated handshakes are refused before connect.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/notifications' })
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(private readonly wsAuth: WsAuthService) {}

  afterInit(server: Server) {
    // Authenticate at the handshake, before the connection is established, so an
    // unauthenticated or spoofed socket never reaches handleConnection or joins a
    // room. The trusted userId is derived from the verified token.
    server.use(async (socket: Socket, next: (err?: Error) => void) => {
      const principal = await this.wsAuth.authenticate(socket);
      if (!principal) return next(new Error('unauthorized'));
      socket.data.userId = principal.userId;
      socket.data.organizationId = principal.organizationId;
      next();
    });
  }

  handleConnection(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      // Unreachable in practice — the handshake middleware refuses unauthenticated
      // sockets before this fires. Belt-and-suspenders in case middleware is bypassed.
      client.disconnect(true);
      return;
    }
    client.join(`user:${userId}`);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
