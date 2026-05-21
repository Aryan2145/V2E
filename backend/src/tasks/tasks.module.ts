import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksCollectiveController } from './tasks-collective.controller';
import { TasksService } from './tasks.service';
import { WorkflowsModule } from '../workflows/workflows.module';
import { HolidaysModule } from '../holidays/holidays.module';

@Module({
  imports: [WorkflowsModule, HolidaysModule],
  controllers: [TasksController, TasksCollectiveController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
