import { Module } from '@nestjs/common';
import { TaskMastersController } from './task-masters.controller';
import { TaskMastersService } from './task-masters.service';
import { ChecklistAccessService } from './checklist-access.service';

@Module({
  controllers: [TaskMastersController],
  providers: [TaskMastersService, ChecklistAccessService],
  exports: [TaskMastersService, ChecklistAccessService],
})
export class TaskMastersModule {}
