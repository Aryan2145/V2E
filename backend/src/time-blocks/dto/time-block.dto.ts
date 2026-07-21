import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTimeBlockDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsISO8601()
  start_at!: string;

  @IsISO8601()
  end_at!: string;

  @IsOptional()
  @IsBoolean()
  all_day?: boolean;
}

export class UpdateTimeBlockDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  note?: string;

  @IsOptional() @IsISO8601()
  start_at?: string;

  @IsOptional() @IsISO8601()
  end_at?: string;

  @IsOptional() @IsBoolean()
  all_day?: boolean;
}
