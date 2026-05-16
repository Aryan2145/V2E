import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CommunicationScope } from '@prisma/client';

export class CreateKnowledgePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsEnum(CommunicationScope)
  scope?: CommunicationScope;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsArray()
  attachment_urls?: { name: string; url: string }[];
}
