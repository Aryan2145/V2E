import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { TicketsModule } from '../tickets/tickets.module';
import { ClockService } from './clock.service';
import { ReplayService } from './replay.service';
import { ClockController } from './clock.controller';

/**
 * Global so any service can inject ClockService without importing this module
 * (which prevents circular deps with the engine modules ReplayService drives).
 */
@Global()
@Module({
  imports: [PrismaModule, SchedulerModule, WorkflowsModule, TicketsModule],
  controllers: [ClockController],
  providers: [ClockService, ReplayService],
  exports: [ClockService, ReplayService],
})
export class ClockModule {}
