import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator'
import { Type } from 'class-transformer'

class ReorderItem {
  @IsString()
  id: string

  @IsNumber()
  order_index: number
}

export class ReorderStepsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items: ReorderItem[]
}

export class SwapStepsDto {
  @IsString()
  stepId1: string

  @IsString()
  stepId2: string
}
