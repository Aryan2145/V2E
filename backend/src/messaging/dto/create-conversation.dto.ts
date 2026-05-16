import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ConversationType } from '@prisma/client';

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  @IsArray()
  @IsUUID('all', { each: true })
  user_ids: string[];

  @IsOptional()
  @IsString()
  name?: string;
}
