import { Module } from '@nestjs/common';
import { GcalModule } from '../gcal/gcal.module';
import { TimeBlocksController } from './time-blocks.controller';
import { TimeBlocksService } from './time-blocks.service';

// PrismaModule is global. GcalModule supplies the Google API + per-user token.
// TimeBlocksService is exported so MeetingsService can fold blocks into busyView.
@Module({
  imports: [GcalModule],
  controllers: [TimeBlocksController],
  providers: [TimeBlocksService],
  exports: [TimeBlocksService],
})
export class TimeBlocksModule {}
