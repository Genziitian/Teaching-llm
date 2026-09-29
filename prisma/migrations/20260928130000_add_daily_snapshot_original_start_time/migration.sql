ALTER TABLE "DailySessionSnapshot"
ADD COLUMN IF NOT EXISTS "originalStartTime" TIMESTAMP(3);
