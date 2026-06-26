import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { HolidaysModule } from '../holidays/holidays.module'
import { TicketsService } from './tickets.service'
import { TicketTemplateAccessService } from './ticket-template-access.service'
import { TicketsController } from './tickets.controller'
import { TicketsMastersController } from './tickets-masters.controller'
import { TicketsReportsController } from './tickets-reports.controller'

@Module({
  imports: [PrismaModule, HolidaysModule],
  controllers: [TicketsMastersController, TicketsReportsController, TicketsController],
  providers: [TicketsService, TicketTemplateAccessService],
  exports: [TicketsService],
})
export class TicketsModule {}
