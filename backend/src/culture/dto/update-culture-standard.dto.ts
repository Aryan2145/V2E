import { PartialType } from '@nestjs/swagger';
import { CreateCultureStandardDto } from './create-culture-standard.dto';

export class UpdateCultureStandardDto extends PartialType(
  CreateCultureStandardDto,
) {}
