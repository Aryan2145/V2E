import { IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class CreateGoalLinkDto {
  /** The goal that helps. The goal being helped comes from the route. */
  @IsUUID()
  supporting_goal_id!: string;

  /** Why this link exists — the strategic assumption, so it can be revisited. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateGoalLinkDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class LinkCandidatesQueryDto {
  @IsIn(['supported_by', 'supports'])
  direction!: 'supported_by' | 'supports';
}
