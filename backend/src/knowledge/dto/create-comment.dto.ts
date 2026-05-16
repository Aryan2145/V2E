import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateKnowledgeCommentDto {
  @IsString()
  body: string;

  @IsOptional()
  @IsUUID()
  parent_comment_id?: string;
}
