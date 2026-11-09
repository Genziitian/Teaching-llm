-- Serial ticket numbers for NEW support tickets only.
-- Existing tickets are left untouched (ticketNumber stays NULL).
-- Column is added WITHOUT a default first so Postgres does not backfill old rows.
CREATE SEQUENCE IF NOT EXISTS "SupportTicket_ticketNumber_seq" START WITH 1001;

ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "ticketNumber" INTEGER;

ALTER TABLE "SupportTicket"
  ALTER COLUMN "ticketNumber" SET DEFAULT nextval('"SupportTicket_ticketNumber_seq"');

ALTER SEQUENCE "SupportTicket_ticketNumber_seq" OWNED BY "SupportTicket"."ticketNumber";

CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");
