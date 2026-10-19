-- Store notes: configurable validity (default 90 days), admin-written
-- highlights/extra rules, and a per-purchase expiry timestamp.
ALTER TABLE "StoreNote" ADD COLUMN "validityDays" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "StoreNote" ADD COLUMN "highlights" TEXT;
ALTER TABLE "StoreNote" ADD COLUMN "extraRules" TEXT;
ALTER TABLE "StoreNoteAccess" ADD COLUMN "expiresAt" TIMESTAMP(3);
-- Existing purchases get the new default 90-day window from purchase date.
UPDATE "StoreNoteAccess" SET "expiresAt" = "createdAt" + INTERVAL '90 days';
