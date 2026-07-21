import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GcalApiService } from '../src/gcal/gcal-api.service';
import { GoogleAccountService } from '../src/gcal/google-account.service';
import { RhythmGoogleSyncService } from '../src/gcal/rhythm-google-sync.service';
import { HolidaysService } from '../src/holidays/holidays.service';

// One-time migration to Path A: replace the per-instance Google events created
// before the recurring-event change with ONE recurring Google event per rhythm.
// Deletes are silent (sendUpdates:'none') so attendees don't get 40+ cancellation
// emails; the single recurring create sends its one invite.
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const api = app.get(GcalApiService, { strict: false });
  const accounts = app.get(GoogleAccountService, { strict: false });
  const rgsync = app.get(RhythmGoogleSyncService, { strict: false });
  const holidays = app.get(HolidaysService, { strict: false });

  const rhythms = await prisma.meetingRhythm.findMany({
    where: { google_event_id: null, is_active: true },
    include: { schedule_entries: true },
  });
  console.log(`${rhythms.length} rhythm(s) to migrate to a recurring Google event.`);

  for (const r of rhythms) {
    const insts = await prisma.meeting.findMany({
      where: { rhythm_id: r.id, google_event_id: { not: null } },
      select: { google_event_id: true },
    });
    const token = await accounts.getRefreshToken(r.created_by_user_id);
    if (token) {
      for (const m of insts) {
        try { await api.deleteEvent(token, m.google_event_id!, 'none'); } catch { /* already gone */ }
      }
    }
    await prisma.meeting.updateMany({ where: { rhythm_id: r.id }, data: { google_event_id: null, google_ical_uid: null } });
    console.log(`  "${r.title}": removed ${insts.length} individual Google events.`);

    const entry = r.schedule_entries[0];
    let holidayDates: string[] = [];
    if (entry && ((entry as any).skip_holidays ?? true)) {
      const start = new Date(entry.start_date); start.setHours(0, 0, 0, 0);
      const end = entry.end_condition === 'on_date' && entry.end_date
        ? new Date(entry.end_date)
        : (() => { const d = new Date(start); d.setFullYear(d.getFullYear() + 1); return d; })();
      const hols = await holidays.getHolidaysInRange(r.organization_id, start, end).catch(() => []);
      holidayDates = (hols as any[]).map((h) => h.date);
    }
    await rgsync.syncUpsert(r.organization_id, r.id, holidayDates);
    const after = await prisma.meetingRhythm.findUnique({ where: { id: r.id }, select: { google_event_id: true } });
    console.log(`  "${r.title}": recurring event ${after?.google_event_id ? 'created (' + after.google_event_id + ')' : 'NOT created (organiser not connected?)'}`);
  }
  await app.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
