-- Meetings v2: opt-out attendance, rhythms, busy view, governance.
--
-- This local DB is empty (0 meeting rows verified at build time), so the data
-- steps below are no-ops here. They are written to be CORRECT AND SAFE on a
-- populated database too: the enum casts remap every legacy value explicitly
-- rather than relying on `response::text::new` (which would fail on any value
-- not present in the new enum). Nothing is ever stranded.

-- ── Data preservation (must run BEFORE the enum swap / column drops) ────────────
-- Fold a reschedule_requested attendee's stated preference into reject_reason so
-- their voice is not lost when reschedule_at/reschedule_note are dropped and the
-- response collapses to `declined`. reject_reason is never overwritten if set.
UPDATE "meeting_attendees"
SET "reject_reason" = COALESCE(
      "reject_reason",
      NULLIF(
        TRIM(BOTH ' ' FROM
          CONCAT(
            'Requested a different time',
            CASE WHEN "reschedule_at" IS NOT NULL THEN ' (' || "reschedule_at"::text || ')' ELSE '' END,
            CASE WHEN "reschedule_note" IS NOT NULL THEN ' — ' || "reschedule_note" ELSE '' END
          )
        ), ''
      )
    )
WHERE "response"::text = 'reschedule_requested';

-- Every decline must carry a reason. Backfill a neutral placeholder for any
-- rejected/reschedule_requested row that still lacks one.
UPDATE "meeting_attendees"
SET "reject_reason" = 'Declined (no reason recorded — migrated)'
WHERE "response"::text IN ('rejected', 'reschedule_requested')
  AND ("reject_reason" IS NULL OR TRIM(BOTH ' ' FROM "reject_reason") = '');

-- ── AlterEnum: MeetingAttendeeResponse → { attending, declined } ────────────────
BEGIN;
CREATE TYPE "MeetingAttendeeResponse_new" AS ENUM ('attending', 'declined');
ALTER TABLE "public"."meeting_attendees" ALTER COLUMN "response" DROP DEFAULT;
ALTER TABLE "meeting_attendees" ALTER COLUMN "response" TYPE "MeetingAttendeeResponse_new" USING (
  CASE "response"::text
    WHEN 'pending'              THEN 'attending'
    WHEN 'accepted'             THEN 'attending'
    WHEN 'rejected'             THEN 'declined'
    WHEN 'reschedule_requested' THEN 'declined'
    ELSE 'attending'
  END::"MeetingAttendeeResponse_new"
);
ALTER TYPE "MeetingAttendeeResponse" RENAME TO "MeetingAttendeeResponse_old";
ALTER TYPE "MeetingAttendeeResponse_new" RENAME TO "MeetingAttendeeResponse";
DROP TYPE "public"."MeetingAttendeeResponse_old";
ALTER TABLE "meeting_attendees" ALTER COLUMN "response" SET DEFAULT 'attending';
COMMIT;

-- ── AlterEnum: MeetingStatus (drop `polling`) ──────────────────────────────────
BEGIN;
CREATE TYPE "MeetingStatus_new" AS ENUM ('scheduled', 'in_progress', 'closed', 'cancelled');
ALTER TABLE "public"."meetings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "meetings" ALTER COLUMN "status" TYPE "MeetingStatus_new" USING (
  CASE "status"::text
    WHEN 'polling' THEN 'scheduled'
    ELSE "status"::text
  END::"MeetingStatus_new"
);
ALTER TYPE "MeetingStatus" RENAME TO "MeetingStatus_old";
ALTER TYPE "MeetingStatus_new" RENAME TO "MeetingStatus";
DROP TYPE "public"."MeetingStatus_old";
ALTER TABLE "meetings" ALTER COLUMN "status" SET DEFAULT 'scheduled';
COMMIT;

-- ── Drop poll machinery ────────────────────────────────────────────────────────
ALTER TABLE "meeting_slot_votes" DROP CONSTRAINT "meeting_slot_votes_slot_id_fkey";
ALTER TABLE "meeting_slots" DROP CONSTRAINT "meeting_slots_meeting_id_fkey";

ALTER TABLE "meeting_attendees" DROP COLUMN "reschedule_at",
DROP COLUMN "reschedule_note",
ADD COLUMN     "is_required" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "response" SET DEFAULT 'attending';

ALTER TABLE "meetings" DROP COLUMN "mode",
DROP COLUMN "poll_duration_min",
DROP COLUMN "poll_window_end",
DROP COLUMN "poll_window_start",
ADD COLUMN     "attendance_taken_at" TIMESTAMP(3),
ADD COLUMN     "rhythm_id" TEXT,
ADD COLUMN     "rhythm_spawn_date" DATE;

DROP TABLE "meeting_slot_votes";
DROP TABLE "meeting_slots";

DROP TYPE "MeetingMode";
DROP TYPE "MeetingSlotSource";
DROP TYPE "MeetingVote";

-- ── Rhythms ────────────────────────────────────────────────────────────────────
CREATE TABLE "meeting_rhythms" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL,
    "online_link" TEXT,
    "online_password" TEXT,
    "location" TEXT,
    "link_type" "MeetingLinkType",
    "link_entity_id" TEXT,
    "agenda" TEXT,
    "duration_min" INTEGER NOT NULL DEFAULT 30,
    "attendee_user_ids" JSONB NOT NULL DEFAULT '[]',
    "optional_user_ids" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_rhythms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meeting_rhythm_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "meeting_rhythm_id" TEXT NOT NULL,
    "schedule_type" "RecurringScheduleType" NOT NULL,
    "every" INTEGER NOT NULL DEFAULT 1,
    "days" JSONB NOT NULL DEFAULT '[]',
    "month_days" JSONB NOT NULL DEFAULT '[]',
    "yearly_dates" JSONB NOT NULL DEFAULT '[]',
    "time" TEXT NOT NULL DEFAULT '09:00',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_condition" "RecurringEndCondition" NOT NULL DEFAULT 'never',
    "end_date" TIMESTAMP(3),
    "end_after" INTEGER,
    "occurrence_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_rhythm_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "meeting_rhythms_organization_id_idx" ON "meeting_rhythms"("organization_id");
CREATE INDEX "meeting_rhythm_schedules_organization_id_is_active_idx" ON "meeting_rhythm_schedules"("organization_id", "is_active");
CREATE INDEX "meetings_rhythm_id_idx" ON "meetings"("rhythm_id");
CREATE UNIQUE INDEX "meetings_rhythm_day_unique" ON "meetings"("rhythm_id", "rhythm_spawn_date");

ALTER TABLE "meetings" ADD CONSTRAINT "meetings_rhythm_id_fkey" FOREIGN KEY ("rhythm_id") REFERENCES "meeting_rhythms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_rhythm_schedules" ADD CONSTRAINT "meeting_rhythm_schedules_meeting_rhythm_id_fkey" FOREIGN KEY ("meeting_rhythm_id") REFERENCES "meeting_rhythms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
