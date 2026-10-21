-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemRef" TEXT,
    "amount" DOUBLE PRECISION,
    "gateway" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "platform" TEXT NOT NULL DEFAULT 'WEB',
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "reason" TEXT,
    "orderRef" TEXT,
    "paymentRef" TEXT,
    "followUpStatus" TEXT NOT NULL DEFAULT 'NEW',
    "followUpNote" TEXT,
    "followedUpBy" TEXT,
    "followedUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentAttempt_userId_idx" ON "PaymentAttempt"("userId");
CREATE INDEX IF NOT EXISTS "PaymentAttempt_status_idx" ON "PaymentAttempt"("status");
CREATE INDEX IF NOT EXISTS "PaymentAttempt_followUpStatus_idx" ON "PaymentAttempt"("followUpStatus");
CREATE INDEX IF NOT EXISTS "PaymentAttempt_createdAt_idx" ON "PaymentAttempt"("createdAt");
CREATE INDEX IF NOT EXISTS "PaymentAttempt_orderRef_idx" ON "PaymentAttempt"("orderRef");

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- reminders & outcome notifications
ALTER TABLE "PaymentAttempt" ADD COLUMN IF NOT EXISTS "remindersSent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PaymentAttempt" ADD COLUMN IF NOT EXISTS "lastReminderAt" TIMESTAMP(3);
ALTER TABLE "PaymentAttempt" ADD COLUMN IF NOT EXISTS "notifiedStatus" TEXT;

-- "What is stopping you?" feedback (manager view only)
ALTER TABLE "PaymentAttempt" ADD COLUMN IF NOT EXISTS "stopReasons" TEXT;
ALTER TABLE "PaymentAttempt" ADD COLUMN IF NOT EXISTS "stopNote" TEXT;
ALTER TABLE "PaymentAttempt" ADD COLUMN IF NOT EXISTS "feedbackAt" TIMESTAMP(3);
ALTER TABLE "PaymentAttempt" ADD COLUMN IF NOT EXISTS "feedbackAskedAt" TIMESTAMP(3);
