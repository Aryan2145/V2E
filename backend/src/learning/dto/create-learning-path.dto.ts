import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { SequentialMode } from '@prisma/client';

export class CreateLearningPathDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  thumbnail_url?: string;

  @IsOptional()
  @IsEnum(SequentialMode)
  mode?: SequentialMode;

  @IsOptional()
  @IsUUID()
  role_id?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimated_minutes?: number;
}
