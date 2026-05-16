import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { RoleLevel } from '@prisma/client';

export class KraItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class KpiItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  metric: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  target: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  unit: string;
}

export class CreateRoleDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  department_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  job_description?: string;

  @ApiPropertyOptional({ enum: RoleLevel, default: RoleLevel.mid })
  @IsEnum(RoleLevel)
  @IsOptional()
  level?: RoleLevel = RoleLevel.mid;

  @ApiPropertyOptional({ type: [KraItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KraItemDto)
  @IsOptional()
  kra?: KraItemDto[];

  @ApiPropertyOptional({ type: [KpiItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KpiItemDto)
  @IsOptional()
  kpi?: KpiItemDto[];
}
