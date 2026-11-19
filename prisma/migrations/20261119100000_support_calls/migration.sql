CREATE TABLE "SupportCall" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CALL',
    "status" TEXT NOT NULL DEFAULT 'RINGING',
    "callerId" TEXT NOT NULL,
    "managerId" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "offer" TEXT,
    "answer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportCall_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportCall_status_type_idx" ON "SupportCall"("status", "type");
CREATE INDEX "SupportCall_callerId_idx" ON "SupportCall"("callerId");

ALTER TABLE "SupportCall" ADD CONSTRAINT "SupportCall_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportCall" ADD CONSTRAINT "SupportCall_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
