import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { MeetingsReportsService } from './meetings-reports.service';

// PrismaModule, AuditModule, AccessRightsModule, NotificationsModule and ClockModule
// are all global; TasksModule is imported to reuse TasksService for action items.
@Module({
  imports: [TasksModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingsReportsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
