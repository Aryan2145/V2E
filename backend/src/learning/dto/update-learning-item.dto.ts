import { PartialType } from '@nestjs/mapped-types';
import { CreateLearningItemDto } from './create-learning-item.dto';

export class UpdateLearningItemDto extends PartialType(CreateLearningItemDto) {}
