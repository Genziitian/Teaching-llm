-- AlterTable User with Sept 26 progress update and mobile archiving fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasUpdatedProgressSept26" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "previousMobileNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "progressUpdatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_hasUpdatedProgressSept26_idx" ON "User"("hasUpdatedProgressSept26");

ALTER TABLE "UpdateSystemSettings" ADD COLUMN IF NOT EXISTS "sept26ProgressUpdateActive" BOOLEAN NOT NULL DEFAULT false;
