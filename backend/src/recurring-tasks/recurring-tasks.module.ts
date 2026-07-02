import { Module } from '@nestjs/common';
import { RecurringTasksController } from './recurring-tasks.controller';
import { RecurringTasksService } from './recurring-tasks.service';
import { RecurringAttachmentsService } from './recurring-attachments.service';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [SchedulerModule],
  controllers: [RecurringTasksController],
  providers: [RecurringTasksService, RecurringAttachmentsService],
  exports: [RecurringTasksService],
})
export class RecurringTasksModule {}
