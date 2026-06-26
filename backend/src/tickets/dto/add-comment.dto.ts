import { IsArray, IsOptional, IsString } from 'class-validator'

export class AddTicketCommentDto {
  @IsString()
  body: string

  @IsOptional()
  @IsString()
  reply_to_comment_id?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachment_urls?: string[]
}
