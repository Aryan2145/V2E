import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  reply_to_comment_id?: string;

  @IsOptional()
  @IsArray()
  attachment_urls?: { name: string; url: string }[];
}
