import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DataScope, OverrideEffect, PermissionAction } from '@prisma/client';

export class RolePermissionEntryDto {
  @IsString() job_role_id!: string;
  @IsString() feature_key!: string;
  @IsEnum(PermissionAction) action!: PermissionAction;
  @IsBoolean() allowed!: boolean;
  // Row-level data scope for this action (scopable content leaves); null ⇒ own.
  @IsOptional() @IsEnum(DataScope) scope?: DataScope | null;
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionEntryDto)
  entries!: RolePermissionEntryDto[];
}

export class SubjectPolicyEntryDto {
  @IsString() subject_key!: string;
  @IsBoolean() default_eligible!: boolean;
}

export class UpdateSubjectPoliciesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectPolicyEntryDto)
  entries!: SubjectPolicyEntryDto[];
}

export class SetUserOverrideDto {
  @IsString() feature_key!: string;
  @IsEnum(PermissionAction) action!: PermissionAction;
  // null clears the override (back to pure role inheritance)
  @IsOptional() @IsEnum(OverrideEffect) effect!: OverrideEffect | null;
  @IsOptional() @IsEnum(DataScope) scope?: DataScope | null;
  @IsOptional() @IsString() reason?: string;
}

export class SetUserSubjectOverrideDto {
  @IsString() subject_key!: string;
  @IsOptional() @IsEnum(OverrideEffect) effect!: OverrideEffect | null;
  @IsOptional() @IsString() reason?: string;
}
