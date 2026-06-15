import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssigneeVisibilityService } from './assignee-visibility.service';
import { AssigneeVisibilityController } from './assignee-visibility.controller';

/**
 * Global so employees/departments/roles services can inject AssigneeVisibilityService
 * to invalidate the cache on mutations without creating circular module deps.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AssigneeVisibilityController],
  providers: [AssigneeVisibilityService],
  exports: [AssigneeVisibilityService],
})
export class AssigneeVisibilityModule {}
