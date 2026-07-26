import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ minLength: 8, description: 'The new password to set for the current user' })
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
