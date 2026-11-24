ALTER TABLE "SupportCall" ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3);
ALTER TABLE "SupportCall" ADD COLUMN IF NOT EXISTS "answeredAt" TIMESTAMP(3);
ALTER TABLE "SupportCall" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "SupportCall_createdAt_idx" ON "SupportCall"("createdAt");

-- Group calls: participants (who joined / left) and pairwise WebRTC signals.
CREATE TABLE IF NOT EXISTS "SupportCallParticipant" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "video" TEXT NOT NULL DEFAULT 'off',
    CONSTRAINT "SupportCallParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupportCallParticipant_callId_userId_key" ON "SupportCallParticipant"("callId", "userId");
ALTER TABLE "SupportCallParticipant" ADD CONSTRAINT "SupportCallParticipant_callId_fkey" FOREIGN KEY ("callId") REFERENCES "SupportCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportCallParticipant" ADD CONSTRAINT "SupportCallParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "SupportCallSignal" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sdp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportCallSignal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SupportCallSignal_callId_toId_idx" ON "SupportCallSignal"("callId", "toId");
ALTER TABLE "SupportCallSignal" ADD CONSTRAINT "SupportCallSignal_callId_fkey" FOREIGN KEY ("callId") REFERENCES "SupportCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
