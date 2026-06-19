import { IsArray, IsEnum, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EntitlementState } from '@prisma/client';

export class EntitlementEntryDto {
  @IsString()
  module_key!: string;

  @IsEnum(EntitlementState)
  state!: EntitlementState;
}

export class UpdateEntitlementsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntitlementEntryDto)
  entries!: EntitlementEntryDto[];
}
