import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ValueItemDto {
  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class UpsertOrgIdentityDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  vision?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mission?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  purpose?: string;

  @ApiPropertyOptional({ type: [ValueItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValueItemDto)
  @IsOptional()
  values?: ValueItemDto[];
}
