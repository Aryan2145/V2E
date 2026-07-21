import { Module } from '@nestjs/common';
import { GcalApiService } from './gcal-api.service';
import { GoogleAccountService } from './google-account.service';
import { MeetingGoogleSyncService } from './meeting-google-sync.service';
import { RhythmGoogleSyncService } from './rhythm-google-sync.service';

// Google Calendar integration. PrismaModule and EncryptionModule (and
// ConfigModule) are global, so this module only needs to declare its own
// providers. Exported services are consumed by AuthModule (connect/callback/
// status/disconnect) and MeetingsModule (forward push + reverse list).
@Module({
  providers: [GcalApiService, GoogleAccountService, MeetingGoogleSyncService, RhythmGoogleSyncService],
  exports: [GcalApiService, GoogleAccountService, MeetingGoogleSyncService, RhythmGoogleSyncService],
})
export class GcalModule {}
