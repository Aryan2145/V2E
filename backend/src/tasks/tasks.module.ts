import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksCollectiveController } from './tasks-collective.controller';
import { TasksService } from './tasks.service';
import { TasksAnalyticsService } from './tasks-analytics.service';
import { TaskAttachmentsService } from './task-attachments.service';
import { WorkflowsModule } from '../workflows/workflows.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { ProjectsModule } from '../projects/projects.module';
import { TaskMastersModule } from '../task-masters/task-masters.module';
import { RecurringTasksModule } from '../recurring-tasks/recurring-tasks.module';

@Module({
  imports: [WorkflowsModule, HolidaysModule, ProjectsModule, TaskMastersModule, RecurringTasksModule],
  controllers: [TasksController, TasksCollectiveController],
  providers: [TasksService, TasksAnalyticsService, TaskAttachmentsService],
  exports: [TasksService, TasksAnalyticsService, TaskAttachmentsService],
})
export class TasksModule {}
