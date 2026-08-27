import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksCollectiveController } from './tasks-collective.controller';
import { PersonScorecardController } from './person-scorecard.controller';
import { TaskAgeingController } from './task-ageing.controller';
import { TaskCalendarController } from './task-calendar.controller';
import { TasksService } from './tasks.service';
import { PersonScorecardService } from './person-scorecard.service';
import { TaskAgeingService } from './task-ageing.service';
import { TaskCalendarService } from './task-calendar.service';
import { TasksAnalyticsService } from './tasks-analytics.service';
import { TaskAttachmentsService } from './task-attachments.service';
import { TaskImportService } from './task-import.service';
import { WorkflowsModule } from '../workflows/workflows.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { ProjectsModule } from '../projects/projects.module';
import { TaskMastersModule } from '../task-masters/task-masters.module';
import { RecurringTasksModule } from '../recurring-tasks/recurring-tasks.module';

@Module({
  imports: [WorkflowsModule, HolidaysModule, ProjectsModule, TaskMastersModule, RecurringTasksModule],
  controllers: [TasksController, TasksCollectiveController, PersonScorecardController, TaskAgeingController, TaskCalendarController],
  providers: [TasksService, TasksAnalyticsService, TaskAttachmentsService, TaskImportService, PersonScorecardService, TaskAgeingService, TaskCalendarService],
  exports: [TasksService, TasksAnalyticsService, TaskAttachmentsService],
})
export class TasksModule {}
