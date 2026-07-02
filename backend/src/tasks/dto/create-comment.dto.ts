import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MaxLength(1000)
  body: string;

  @IsOptional()
  @IsString()
  reply_to_comment_id?: string;

  @IsOptional()
  @IsArray()
  attachment_urls?: { name: string; url: string }[];
}
