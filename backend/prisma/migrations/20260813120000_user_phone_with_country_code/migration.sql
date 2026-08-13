-- Login identity can now be email OR phone. The phone is stored as two parts:
-- the dialling country code ("+91") kept separate from the national number
-- (digits only). Uniqueness — and the login lookup index — is on the PAIR.

-- Email becomes optional (a phone-only account has no email).
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- Add the two phone identity columns (both optional; always set together or both NULL).
ALTER TABLE "users" ADD COLUMN "country_code" TEXT;
ALTER TABLE "users" ADD COLUMN "phone" TEXT;

-- Unique on the (country_code, phone) pair. This one B-tree both enforces
-- uniqueness and serves the login lookup WHERE country_code = ? AND phone = ?.
-- Postgres allows many NULL rows under a unique index, so existing email-only
-- users (country_code + phone both NULL) are unaffected.
CREATE UNIQUE INDEX "users_country_code_phone_key" ON "users"("country_code", "phone");
