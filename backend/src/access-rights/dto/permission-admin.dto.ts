import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DataScope, OverrideEffect, PermissionAction } from '@prisma/client';

export class RolePermissionEntryDto {
  @IsString() system_role_id!: string;
  @IsString() feature_key!: string;
  @IsEnum(PermissionAction) action!: PermissionAction;
  @IsBoolean() allowed!: boolean;
  // Line-tier data scope for this action (scopable content leaves); null ⇒ inherit.
  @IsOptional() @IsEnum(DataScope) scope?: DataScope | null;
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionEntryDto)
  entries!: RolePermissionEntryDto[];
}

// ─── System Role CRUD ──────────────────────────────────────────────────────────

export class CreateSystemRoleDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  @IsOptional() @IsString() @MaxLength(280) description?: string;
  // Global tier of the data-scope cascade. Defaults to `own` (safe floor).
  @IsOptional() @IsEnum(DataScope) default_scope?: DataScope;
}

export class UpdateSystemRoleDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @IsString() @MaxLength(280) description?: string;
  @IsOptional() @IsEnum(DataScope) default_scope?: DataScope;
}

export class SetModuleScopeDto {
  @IsString() module_key!: string;
  // null clears the module override (module re-inherits the role's default_scope).
  @IsOptional() @IsEnum(DataScope) scope?: DataScope | null;
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
