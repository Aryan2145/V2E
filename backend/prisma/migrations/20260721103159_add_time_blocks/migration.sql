-- CreateEnum
CREATE TYPE "TimeBlockSource" AS ENUM ('native', 'google');

-- CreateTable
CREATE TABLE "time_blocks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "source" "TimeBlockSource" NOT NULL DEFAULT 'native',
    "google_event_id" TEXT,
    "google_ical_uid" TEXT,
    "google_updated_at" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_blocks_user_id_start_at_idx" ON "time_blocks"("user_id", "start_at");

-- CreateIndex
CREATE INDEX "time_blocks_user_id_google_ical_uid_idx" ON "time_blocks"("user_id", "google_ical_uid");

-- AddForeignKey
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
