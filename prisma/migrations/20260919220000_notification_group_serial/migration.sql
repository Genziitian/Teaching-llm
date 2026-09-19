-- Serial number for notification Google Group mail assigner (1..N).
-- Does NOT affect course Google Groups.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notificationGroupSerial" INTEGER;

-- Default capacity for new notification pool emails (700 members per group).
ALTER TABLE "NotificationPoolEmail" ALTER COLUMN "maxCapacity" SET DEFAULT 700;
