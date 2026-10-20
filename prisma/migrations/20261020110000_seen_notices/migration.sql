-- One-time notices (policy updates etc.) an account has already seen.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "seenNotices" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
