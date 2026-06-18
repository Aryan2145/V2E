import { Module } from '@nestjs/common';
import { WorkLogsController } from './work-logs.controller';
import { WorkLogsService } from './work-logs.service';

// PrismaModule, NotificationsModule, ClockModule and AssigneeVisibilityModule are all
// global, so they need not be imported here.
@Module({
  controllers: [WorkLogsController],
  providers: [WorkLogsService],
  exports: [WorkLogsService],
})
export class WorkLogsModule {}
