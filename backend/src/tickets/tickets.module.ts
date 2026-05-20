import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TicketsService } from './tickets.service'
import { TicketsController } from './tickets.controller'
import { TicketsMastersController } from './tickets-masters.controller'
import { TicketsReportsController } from './tickets-reports.controller'

@Module({
  imports: [PrismaModule],
  controllers: [TicketsMastersController, TicketsReportsController, TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
