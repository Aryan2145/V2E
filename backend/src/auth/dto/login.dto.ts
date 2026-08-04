import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  // Email OR phone number — the user signs in with whichever they have on file.
  @ApiProperty({ description: 'Email address or phone number' })
  @IsString()
  identifier: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;
}
