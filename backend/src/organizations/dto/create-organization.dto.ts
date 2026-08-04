import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

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

  @ApiPropertyOptional({ description: 'Mark as a test client — enables the controllable simulated clock' })
  @IsBoolean()
  @IsOptional()
  is_test?: boolean;
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

  @ApiPropertyOptional({ description: 'Admin mobile number — an alternative login identity' })
  @IsString()
  @IsOptional()
  admin_phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MinLength(8)
  admin_password?: string;
}
