-- Login activity: device + coarse location per login (all nullable; older rows stay as they are).
ALTER TABLE "LoginLog" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE "LoginLog" ADD COLUMN IF NOT EXISTS "deviceName" TEXT;
ALTER TABLE "LoginLog" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "LoginLog" ADD COLUMN IF NOT EXISTS "os" TEXT;
ALTER TABLE "LoginLog" ADD COLUMN IF NOT EXISTS "appVersion" TEXT;
ALTER TABLE "LoginLog" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "LoginLog" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "LoginLog" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "LoginLog" ADD COLUMN IF NOT EXISTS "country" TEXT;
CREATE INDEX IF NOT EXISTS "LoginLog_userId_timestamp_idx" ON "LoginLog"("userId", "timestamp");
