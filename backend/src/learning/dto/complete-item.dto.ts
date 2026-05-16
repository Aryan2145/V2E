import { IsEnum } from 'class-validator';
import { CompletionType } from '@prisma/client';

export class CompleteItemDto {
  @IsEnum(CompletionType)
  completion_type: CompletionType;
}
