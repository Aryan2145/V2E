import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CommunicationScope, BoardInteractionMode } from '@prisma/client';

export class CreateBoardDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CommunicationScope)
  scope?: CommunicationScope;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsEnum(BoardInteractionMode)
  interaction_mode?: BoardInteractionMode;
}
