import { Module } from '@nestjs/common';
import { WsAuthModule } from '../auth/ws-auth.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [WsAuthModule],
  controllers: [MessagingController],
  providers: [MessagingService, ChatGateway],
})
export class MessagingModule {}
