import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  logo_url?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  group_id?: string;
}

export class CreateOrgWithAdminDto extends CreateOrganizationDto {
  // Option A: pick an existing user by ID (group user picker)
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  existing_user_id?: string;

  // Option B: create/use by email
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  admin_name?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  admin_email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MinLength(8)
  admin_password?: string;
}
