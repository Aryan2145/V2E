import { Module } from '@nestjs/common';
import { TaskMastersController } from './task-masters.controller';
import { TaskMastersService } from './task-masters.service';

@Module({
  controllers: [TaskMastersController],
  providers: [TaskMastersService],
  exports: [TaskMastersService],
})
export class TaskMastersModule {}
