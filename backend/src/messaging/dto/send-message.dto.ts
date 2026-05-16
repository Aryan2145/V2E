import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @IsString()
  body: string;

  @IsOptional()
  @IsArray()
  attachment_urls?: { name: string; url: string }[];

  @IsOptional()
  @IsUUID()
  reply_to_message_id?: string;
}
