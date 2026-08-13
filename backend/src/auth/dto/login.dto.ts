import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  // Email OR phone number — the user signs in with whichever they have on file.
  // When `identifier` is a phone number, `country_code` says which country it
  // belongs to; the pair (country_code, national digits) is what's matched.
  @ApiProperty({ description: 'Email address or phone number' })
  @IsString()
  identifier: string;

  @ApiPropertyOptional({ description: 'Dialling country code (e.g. "+91") — only used when the identifier is a phone number' })
  @IsString()
  @IsOptional()
  country_code?: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;
}
