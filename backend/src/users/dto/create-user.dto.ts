import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'Login phone — national digits only (no country code). Send "" to clear.' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Dialling country code for the phone, e.g. "+91". Defaults to +91.' })
  @IsString()
  @IsOptional()
  country_code?: string;

  @ApiPropertyOptional({ description: 'Grant platform-admin rights in the organization' })
  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  organization_id?: string;
}
