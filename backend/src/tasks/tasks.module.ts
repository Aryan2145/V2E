import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksCollectiveController } from './tasks-collective.controller';
import { TasksService } from './tasks.service';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [WorkflowsModule],
  controllers: [TasksController, TasksCollectiveController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
