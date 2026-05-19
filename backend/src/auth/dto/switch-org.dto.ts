import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwitchOrgDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  organizationId: string;
}
