import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { LearningFilesService } from './learning-files.service';

@Module({
  imports: [PrismaModule],
  controllers: [LearningController],
  providers: [LearningService, LearningFilesService],
  exports: [LearningService],
})
export class LearningModule {}
