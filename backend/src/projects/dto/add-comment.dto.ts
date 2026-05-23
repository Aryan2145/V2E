import { IsString, IsOptional, IsArray } from 'class-validator';

export class AddCommentDto {
  @IsString()
  body: string;

  @IsOptional()
  @IsArray()
  attachment_urls?: { name: string; url: string }[];

  @IsOptional()
  @IsString()
  reply_to_comment_id?: string;
}
