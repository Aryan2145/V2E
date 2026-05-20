import { IsString } from 'class-validator'

export class TriggerInstanceDto {
  @IsString()
  name: string
}
