-- Genie live chat: link a chat session to the ticket it becomes.
-- Additive only: new nullable columns on "ChatSession". Existing rows are not changed.
ALTER TABLE "ChatSession" ADD COLUMN IF NOT EXISTS "ticketId" TEXT;
ALTER TABLE "ChatSession" ADD COLUMN IF NOT EXISTS "joinedAt" TIMESTAMP(3);
ALTER TABLE "ChatSession" ADD COLUMN IF NOT EXISTS "movedReason" TEXT;
ALTER TABLE "ChatSession" ADD COLUMN IF NOT EXISTS "rating" INTEGER;
ALTER TABLE "ChatSession" ADD COLUMN IF NOT EXISTS "context" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ChatSession_ticketId_key" ON "ChatSession"("ticketId");
CREATE INDEX IF NOT EXISTS "ChatSession_type_status_idx" ON "ChatSession"("type", "status");
