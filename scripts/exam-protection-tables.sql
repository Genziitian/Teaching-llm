-- Exam Protection: additive, safe to re-run. Paste into Supabase SQL Editor and Run.
BEGIN;
CREATE TABLE IF NOT EXISTS "ProtectionSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtectionSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProtectionPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "courseKey" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "academicTerm" TEXT,
    "academicYear" INTEGER,
    "fee" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerOrderId" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "ProtectionPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProtectionClaim" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "benefit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "reason" TEXT NOT NULL,
    "attempted" BOOLEAN NOT NULL,
    "marks" DOUBLE PRECISION,
    "message" TEXT NOT NULL DEFAULT '',
    "refundAmount" INTEGER,
    "refundReference" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "couponId" TEXT,
    "couponRevealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtectionClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProtectionProof" (
    "claimId" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtectionProof_pkey" PRIMARY KEY ("claimId")
);

CREATE TABLE IF NOT EXISTS "ProtectionClaimEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtectionClaimEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProtectionCourse" (
    "courseId" TEXT NOT NULL,
    "fee" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtectionCourse_pkey" PRIMARY KEY ("courseId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProtectionPurchase_providerOrderId_key" ON "ProtectionPurchase"("providerOrderId");

CREATE UNIQUE INDEX IF NOT EXISTS "ProtectionPurchase_paymentId_key" ON "ProtectionPurchase"("paymentId");

CREATE INDEX IF NOT EXISTS "ProtectionPurchase_status_paidAt_idx" ON "ProtectionPurchase"("status", "paidAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ProtectionPurchase_userId_courseKey_key" ON "ProtectionPurchase"("userId", "courseKey");

CREATE UNIQUE INDEX IF NOT EXISTS "ProtectionClaim_purchaseId_key" ON "ProtectionClaim"("purchaseId");

CREATE UNIQUE INDEX IF NOT EXISTS "ProtectionClaim_couponId_key" ON "ProtectionClaim"("couponId");

CREATE INDEX IF NOT EXISTS "ProtectionClaim_createdAt_idx" ON "ProtectionClaim"("createdAt");

CREATE INDEX IF NOT EXISTS "ProtectionProof_expiresAt_idx" ON "ProtectionProof"("expiresAt");

CREATE INDEX IF NOT EXISTS "ProtectionClaimEvent_claimId_createdAt_idx" ON "ProtectionClaimEvent"("claimId", "createdAt");

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProtectionPurchase_userId_fkey') THEN ALTER TABLE "ProtectionPurchase" ADD CONSTRAINT "ProtectionPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProtectionPurchase_courseId_fkey') THEN ALTER TABLE "ProtectionPurchase" ADD CONSTRAINT "ProtectionPurchase_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProtectionClaim_purchaseId_fkey') THEN ALTER TABLE "ProtectionClaim" ADD CONSTRAINT "ProtectionClaim_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "ProtectionPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProtectionClaim_couponId_fkey') THEN ALTER TABLE "ProtectionClaim" ADD CONSTRAINT "ProtectionClaim_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProtectionProof_claimId_fkey') THEN ALTER TABLE "ProtectionProof" ADD CONSTRAINT "ProtectionProof_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ProtectionClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProtectionClaimEvent_claimId_fkey') THEN ALTER TABLE "ProtectionClaimEvent" ADD CONSTRAINT "ProtectionClaimEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ProtectionClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProtectionCourse_courseId_fkey') THEN ALTER TABLE "ProtectionCourse" ADD CONSTRAINT "ProtectionCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
COMMIT;

-- Verify (expect 6 rows):
SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'Protection%';
