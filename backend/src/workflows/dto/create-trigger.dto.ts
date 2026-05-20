import { IsString, IsObject, IsOptional, IsBoolean } from 'class-validator'

export class CreateTriggerDto {
  @IsString()
  type: string

  @IsObject()
  config: Record<string, unknown>

  @IsOptional()
  @IsBoolean()
  is_active?: boolean
}
