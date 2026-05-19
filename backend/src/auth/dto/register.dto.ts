import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';

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

  @ApiProperty({ enum: MemberRole, required: false })
  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  organization_id?: string;
}
