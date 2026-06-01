import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { HolidaysModule } from '../holidays/holidays.module';

@Module({
  imports: [PrismaModule, HolidaysModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
