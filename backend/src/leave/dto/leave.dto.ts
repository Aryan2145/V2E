import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

// ─── Self / employee ────────────────────────────────────────────────────────────

export class CreateLeaveDto {
  @IsString()
  start_date: string; // ISO yyyy-mm-dd (inclusive)

  @IsString()
  end_date: string; // ISO yyyy-mm-dd (inclusive)

  @IsOptional()
  @IsString()
  reason?: string;

  // Declare unplanned leave (e.g. a sick day) directly, bypassing the approval
  // request flow. Honoured only when the org allows overrides / self-marking.
  @IsOptional()
  @IsBoolean()
  declare?: boolean;
}

export class DecideLeaveDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  note?: string;
}

// ─── Per-org policy (admin) ───────────────────────────────────────────────────────

export class UpdateLeaveMasterDto {
  @IsOptional()
  @IsIn(['self_mark', 'manager', 'approvers', 'manager_or_approvers'])
  approval_mode?: 'self_mark' | 'manager' | 'approvers' | 'manager_or_approvers';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  approver_user_ids?: string[];

  @IsOptional()
  @IsBoolean()
  any_one_can_approve?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_override?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  recurring_notice_days?: number;
}
