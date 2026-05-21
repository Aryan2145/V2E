import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { HolidaysController } from './holidays.controller'
import { HolidaysService } from './holidays.service'
import { NagerService } from './nager.service'
import { HolidaySchedulerService } from './holiday-scheduler.service'

@Module({
  imports: [PrismaModule],
  controllers: [HolidaysController],
  providers: [HolidaysService, NagerService, HolidaySchedulerService],
  exports: [HolidaysService],
})
export class HolidaysModule {}
