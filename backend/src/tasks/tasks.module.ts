import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksCollectiveController } from './tasks-collective.controller';
import { TasksService } from './tasks.service';
import { WorkflowsModule } from '../workflows/workflows.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [WorkflowsModule, HolidaysModule, ProjectsModule],
  controllers: [TasksController, TasksCollectiveController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
