import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TemplateItemDto {
  @IsString()
  title: string;

  @IsOptional()
  order_index?: number;
}

export class CreateChecklistTemplateDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items?: TemplateItemDto[];
}
