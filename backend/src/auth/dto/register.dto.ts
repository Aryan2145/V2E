import { IsEmail, IsString, MinLength, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ required: false, description: 'Grant platform-admin rights in the organization' })
  @IsOptional()
  @IsBoolean()
  is_admin?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  organization_id?: string;
}
