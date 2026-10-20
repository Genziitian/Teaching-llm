-- CreateTable
CREATE TABLE "ProtectionSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtectionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtectionPurchase" (
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

-- CreateTable
CREATE TABLE "ProtectionClaim" (
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

-- CreateTable
CREATE TABLE "ProtectionProof" (
    "claimId" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtectionProof_pkey" PRIMARY KEY ("claimId")
);

-- CreateTable
CREATE TABLE "ProtectionClaimEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtectionClaimEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtectionCourse" (
    "courseId" TEXT NOT NULL,
    "fee" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtectionCourse_pkey" PRIMARY KEY ("courseId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProtectionPurchase_providerOrderId_key" ON "ProtectionPurchase"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtectionPurchase_paymentId_key" ON "ProtectionPurchase"("paymentId");

-- CreateIndex
CREATE INDEX "ProtectionPurchase_status_paidAt_idx" ON "ProtectionPurchase"("status", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProtectionPurchase_userId_courseKey_key" ON "ProtectionPurchase"("userId", "courseKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProtectionClaim_purchaseId_key" ON "ProtectionClaim"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtectionClaim_couponId_key" ON "ProtectionClaim"("couponId");

-- CreateIndex
CREATE INDEX "ProtectionClaim_createdAt_idx" ON "ProtectionClaim"("createdAt");

-- CreateIndex
CREATE INDEX "ProtectionProof_expiresAt_idx" ON "ProtectionProof"("expiresAt");

-- CreateIndex
CREATE INDEX "ProtectionClaimEvent_claimId_createdAt_idx" ON "ProtectionClaimEvent"("claimId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProtectionPurchase" ADD CONSTRAINT "ProtectionPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionPurchase" ADD CONSTRAINT "ProtectionPurchase_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionClaim" ADD CONSTRAINT "ProtectionClaim_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "ProtectionPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionClaim" ADD CONSTRAINT "ProtectionClaim_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionProof" ADD CONSTRAINT "ProtectionProof_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ProtectionClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionClaimEvent" ADD CONSTRAINT "ProtectionClaimEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ProtectionClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionCourse" ADD CONSTRAINT "ProtectionCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

