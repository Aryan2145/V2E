import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum BehaviorType {
  EXPECTED_BEHAVIOR = 'expected_behavior',
  UNACCEPTABLE_BEHAVIOR = 'unacceptable_behavior',
}

export class CreateCultureStandardDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: BehaviorType })
  @IsEnum(BehaviorType)
  type: BehaviorType;
}
