import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RecurringAccessKind, RecurringAccessLevel } from '@prisma/client';

/** Body for POST /:id/access — add/change one person's Google-Drive-style override. */
export class SetAccessDto {
  @IsString()
  user_id!: string;

  @IsEnum(RecurringAccessKind)
  kind!: RecurringAccessKind;

  // Required only when kind=grant; ignored for revoke.
  @IsOptional()
  @IsEnum(RecurringAccessLevel)
  level?: RecurringAccessLevel;
}
