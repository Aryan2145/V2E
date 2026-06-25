import { Module } from '@nestjs/common';
import { TaskMastersController } from './task-masters.controller';
import { TaskMastersService } from './task-masters.service';
import { ChecklistAccessService } from './checklist-access.service';
import { ChecklistImportService } from './checklist-import.service';

@Module({
  controllers: [TaskMastersController],
  providers: [TaskMastersService, ChecklistAccessService, ChecklistImportService],
  exports: [TaskMastersService, ChecklistAccessService, ChecklistImportService],
})
export class TaskMastersModule {}
