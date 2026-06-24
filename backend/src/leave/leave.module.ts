import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';

/**
 * Global so tasks/scheduler services can inject LeaveService (for the picker badge,
 * availability warnings and recurring look-ahead) without circular module deps.
 * ClockService and NotificationsService are themselves @Global.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
