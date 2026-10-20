-- Remembers per account that the one-time Play Store welcome was shown.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasSeenPlayStoreWelcome" BOOLEAN NOT NULL DEFAULT false;
