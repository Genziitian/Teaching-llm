-- Unique permanent serial for notification group packing + manager search.
-- One serial per user; never reuse.
CREATE UNIQUE INDEX IF NOT EXISTS "User_notificationGroupSerial_key"
  ON "User"("notificationGroupSerial");
