import { IsEnum, IsOptional } from 'class-validator';
import { ProofVisibility } from '@prisma/client';

/**
 * Body for submitting a proof file. The file itself rides on the multipart `file`
 * field; this carries only who may see the proof. Defaults to `private` (uploader +
 * assigner + admins). Ignored in any_can_complete mode, where proofs are always shared.
 */
export class SubmitProofDto {
  @IsOptional()
  @IsEnum(ProofVisibility)
  visibility?: ProofVisibility;
}
