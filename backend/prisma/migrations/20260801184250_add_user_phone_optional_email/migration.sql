-- Login identity can now be email OR phone (at least one, enforced in the service).

-- Make email optional (a phone-only account has no email).
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- Add optional phone identity.
ALTER TABLE "users" ADD COLUMN "phone" TEXT;

-- Unique phone. Postgres allows many NULLs under a unique index, so existing
-- (phone-less) users are unaffected.
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
