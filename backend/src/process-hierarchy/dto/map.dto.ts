import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMapDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}

export class UpdateMapDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}
