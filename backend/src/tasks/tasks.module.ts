import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksCollectiveController } from './tasks-collective.controller';
import { TasksService } from './tasks.service';
import { TasksAnalyticsService } from './tasks-analytics.service';
import { WorkflowsModule } from '../workflows/workflows.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { ProjectsModule } from '../projects/projects.module';
import { TaskMastersModule } from '../task-masters/task-masters.module';

@Module({
  imports: [WorkflowsModule, HolidaysModule, ProjectsModule, TaskMastersModule],
  controllers: [TasksController, TasksCollectiveController],
  providers: [TasksService, TasksAnalyticsService],
  exports: [TasksService, TasksAnalyticsService],
})
export class TasksModule {}
