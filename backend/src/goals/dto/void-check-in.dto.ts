import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * A check-in is never edited or deleted — it is voided, and the reason is
 * required so the history explains itself years later.
 */
export class VoidCheckInDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
