import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { GcalModule } from '../gcal/gcal.module';
import { TimeBlocksModule } from '../time-blocks/time-blocks.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { MeetingsReportsService } from './meetings-reports.service';
import { MeetingRhythmsService } from './meeting-rhythms.service';

// PrismaModule, AuditModule, AccessRightsModule, NotificationsModule, ClockModule and
// LeaveModule are all global. TasksModule is imported to reuse TasksService (action
// items). SchedulerModule provides the rhythm spawner; HolidaysModule powers the busy
// view's holiday overlay.
@Module({
  imports: [TasksModule, SchedulerModule, HolidaysModule, GcalModule, TimeBlocksModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingsReportsService, MeetingRhythmsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
