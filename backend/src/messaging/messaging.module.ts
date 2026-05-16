import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { ChatGateway } from './chat.gateway';

@Module({
  controllers: [MessagingController],
  providers: [MessagingService, ChatGateway],
})
export class MessagingModule {}
