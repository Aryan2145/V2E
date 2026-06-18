-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('online', 'offline', 'hybrid');

-- CreateEnum
CREATE TYPE "MeetingMode" AS ENUM ('fixed', 'poll');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('polling', 'scheduled', 'in_progress', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "MeetingLinkType" AS ENUM ('goal', 'project', 'task', 'ticket');

-- CreateEnum
CREATE TYPE "MeetingAttendeeResponse" AS ENUM ('pending', 'accepted', 'rejected', 'reschedule_requested');

-- CreateEnum
CREATE TYPE "MeetingSlotSource" AS ENUM ('caller', 'invitee', 'system');

-- CreateEnum
CREATE TYPE "MeetingVote" AS ENUM ('available', 'unavailable', 'maybe');

-- AlterEnum
ALTER TYPE "NotificationModule" ADD VALUE 'meetings';

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL,
    "online_link" TEXT,
    "online_password" TEXT,
    "location" TEXT,
    "mode" "MeetingMode" NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'scheduled',
    "link_type" "MeetingLinkType",
    "link_entity_id" TEXT,
    "agenda" TEXT,
    "minutes" TEXT,
    "scheduled_start" TIMESTAMP(3),
    "scheduled_end" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "poll_window_start" TIMESTAMP(3),
    "poll_window_end" TIMESTAMP(3),
    "poll_duration_min" INTEGER,
    "created_by_user_id" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" TEXT,
    "deletion_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendees" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_organizer" BOOLEAN NOT NULL DEFAULT false,
    "response" "MeetingAttendeeResponse" NOT NULL DEFAULT 'pending',
    "reject_reason" TEXT,
    "reschedule_at" TIMESTAMP(3),
    "reschedule_note" TEXT,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "attended_in_at" TIMESTAMP(3),
    "attended_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_slots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "source" "MeetingSlotSource" NOT NULL,
    "proposed_by_user_id" TEXT,
    "system_rank" INTEGER,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_slot_votes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "vote" "MeetingVote" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_slot_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_action_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "due_date" TIMESTAMP(3),
    "linked_task_id" TEXT,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_decisions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "decided_on" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "affects_link_type" "MeetingLinkType",
    "affects_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_private_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_private_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meetings_organization_id_status_scheduled_start_idx" ON "meetings"("organization_id", "status", "scheduled_start");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_attendees_meeting_id_user_id_key" ON "meeting_attendees"("meeting_id", "user_id");

-- CreateIndex
CREATE INDEX "meeting_slots_meeting_id_idx" ON "meeting_slots"("meeting_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_slot_votes_slot_id_user_id_key" ON "meeting_slot_votes"("slot_id", "user_id");

-- CreateIndex
CREATE INDEX "meeting_action_items_organization_id_owner_user_id_idx" ON "meeting_action_items"("organization_id", "owner_user_id");

-- CreateIndex
CREATE INDEX "meeting_decisions_organization_id_decided_on_idx" ON "meeting_decisions"("organization_id", "decided_on");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_private_notes_meeting_id_user_id_key" ON "meeting_private_notes"("meeting_id", "user_id");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_slots" ADD CONSTRAINT "meeting_slots_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_slot_votes" ADD CONSTRAINT "meeting_slot_votes_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "meeting_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_action_items" ADD CONSTRAINT "meeting_action_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_decisions" ADD CONSTRAINT "meeting_decisions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_private_notes" ADD CONSTRAINT "meeting_private_notes_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
