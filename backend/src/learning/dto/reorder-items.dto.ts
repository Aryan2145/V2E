import { Type } from 'class-transformer';
import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

class ReorderItem {
  @IsUUID()
  id: string;

  @IsInt()
  @Min(0)
  order_index: number;
}

export class ReorderItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items: ReorderItem[];
}
