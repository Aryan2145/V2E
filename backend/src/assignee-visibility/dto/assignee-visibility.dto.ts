import { BridgeDepth } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateAssigneeSettingsDto {
  @IsOptional()
  @IsBoolean()
  master_override?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  full_visibility_roles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  full_visibility_users?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  config_roles?: string[];
}

export class CreateBridgeDto {
  @IsString()
  from_department_id: string;

  @IsString()
  to_department_id: string;

  @IsEnum(BridgeDepth)
  depth: BridgeDepth;

  @IsOptional()
  @IsBoolean()
  include_sub_departments?: boolean;
}

export class SetDeptUpwardDto {
  @IsString()
  department_id: string;

  @IsBoolean()
  allow: boolean;
}

export class SetDeptUnifyDto {
  @IsString()
  department_id: string;

  @IsBoolean()
  unify: boolean;
}

export class SetEmployeeManualOverrideDto {
  @IsString()
  employee_user_id: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(2000)
  added_user_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(2000)
  removed_user_ids?: string[];
}
