import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ProcessAccessKind, ProcessAccessLevel } from '@prisma/client';

/**
 * Add one attachment/sharing rule to a node. Mirrors the checklist-template access
 * model: a department attach is a LIVE rule (joiners/leavers auto-reflect);
 * individual add/remove is stored as extra `user` / `exclude_user` rows.
 */
export class AddAccessRuleDto {
  @IsEnum(ProcessAccessKind)
  kind!: ProcessAccessKind;

  @IsOptional()
  @IsEnum(ProcessAccessLevel)
  level?: ProcessAccessLevel; // defaults to view; exclude_user ignores level

  @IsOptional()
  @IsUUID()
  department_id?: string; // when kind = department

  @IsOptional()
  @IsBoolean()
  include_sub_departments?: boolean; // when kind = department (default true)

  @IsOptional()
  @IsUUID()
  role_id?: string; // when kind = role

  @IsOptional()
  @IsUUID()
  user_id?: string; // when kind = user / exclude_user
}
