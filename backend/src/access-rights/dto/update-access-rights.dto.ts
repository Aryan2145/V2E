import {
  IsArray,
  IsBoolean,
  IsIn,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CONFIGURABLE_ROLES } from '../access-rights.constants';

export class AccessRightEntryDto {
  @IsIn(CONFIGURABLE_ROLES as unknown as string[])
  role!: string; // hr_manager | employee (org_admin is implicit-all, not configurable)

  @IsString()
  resource!: string;

  @IsBoolean()
  can_read!: boolean;

  @IsBoolean()
  can_write!: boolean;

  @IsBoolean()
  can_edit!: boolean;

  @IsBoolean()
  can_delete!: boolean;
}

export class UpdateAccessRightsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccessRightEntryDto)
  entries!: AccessRightEntryDto[];
}
