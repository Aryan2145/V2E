import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { GoalsModule } from '../goals/goals.module';

@Module({
  imports: [PrismaModule, HolidaysModule, GoalsModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
