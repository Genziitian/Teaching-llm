/**
 * EMERGENCY SCHEMA SYNC — Fixes courses disappearance
 * 
 * Root Cause: The `liveUpgradePrice` column was added to schema.prisma
 * but never migrated to the production PostgreSQL database.
 * 
 * Fully idempotent — safe to run multiple times.
 * Usage: DATABASE_URL="postgresql://..." node emergency_schema_sync.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function safeExec(sql, label) {
  try {
    await prisma.$executeRawUnsafe(sql)
    return true
  } catch (e) {
    console.log(`  ⚠️  ${label}: ${e.meta?.message || e.message}`)
    return false
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗')
  console.log('║   EMERGENCY SCHEMA SYNC — Courses Fix            ║')
  console.log('╚═══════════════════════════════════════════════════╝\n')

  // ─── FIX #1: THE PRIMARY BLOCKER ──────────────────────────
  console.log('[1/5] Adding liveUpgradePrice to Class table...')
  await safeExec(
    `ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "liveUpgradePrice" DOUBLE PRECISION;`,
    'liveUpgradePrice'
  )
  await safeExec(
    `ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "academicTerm" TEXT;`,
    'academicTerm'
  )
  await safeExec(
    `ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "academicYear" INTEGER;`,
    'academicYear'
  )
  await safeExec(
    `ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "examCycle" TEXT;`,
    'examCycle'
  )
  console.log('  ✅ liveUpgradePrice & academic columns ready')

  // ─── FIX #2: UpgradeTransaction table ─────────────────────
  console.log('[2/5] Creating UpgradeTransaction table...')
  await safeExec(`
    CREATE TABLE IF NOT EXISTS "UpgradeTransaction" (
      "id" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "razorpayOrderId" TEXT NOT NULL,
      "razorpayPaymentId" TEXT,
      "razorpaySignature" TEXT,
      "userId" TEXT NOT NULL,
      "classId" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UpgradeTransaction_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "UpgradeTransaction_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "UpgradeTransaction_classId_fkey" FOREIGN KEY ("classId")
        REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `, 'UpgradeTransaction')
  for (const idx of [
    `CREATE UNIQUE INDEX IF NOT EXISTS "UpgradeTransaction_orderId_key" ON "UpgradeTransaction"("orderId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UpgradeTransaction_razorpayOrderId_key" ON "UpgradeTransaction"("razorpayOrderId")`,
    `CREATE INDEX IF NOT EXISTS "UpgradeTransaction_userId_idx" ON "UpgradeTransaction"("userId")`,
    `CREATE INDEX IF NOT EXISTS "UpgradeTransaction_classId_idx" ON "UpgradeTransaction"("classId")`,
    `CREATE INDEX IF NOT EXISTS "UpgradeTransaction_status_idx" ON "UpgradeTransaction"("status")`,
    `CREATE INDEX IF NOT EXISTS "UpgradeTransaction_createdAt_idx" ON "UpgradeTransaction"("createdAt")`,
  ]) { await safeExec(idx, 'index') }
  console.log('  ✅ UpgradeTransaction table ready')

  // ─── FIX #3: TopicSharedContent.order column ──────────────
  console.log('[3/5] Adding order column to TopicSharedContent...')
  await safeExec(
    `ALTER TABLE "TopicSharedContent" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;`,
    'TopicSharedContent.order'
  )
  console.log('  ✅ TopicSharedContent.order column ready')

  // ─── FIX #4: WebhookLog schema sync ───────────────────────
  console.log('[4/5] Syncing WebhookLog table...')
  // Create the table first if it doesn't exist (handles fresh DBs)
  await safeExec(`
    CREATE TABLE IF NOT EXISTS "WebhookLog" (
      "id" TEXT NOT NULL,
      "webhookEventId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "payload" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'RECEIVED',
      "error" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
    );
  `, 'WebhookLog create')
  await safeExec(`CREATE UNIQUE INDEX IF NOT EXISTS "WebhookLog_webhookEventId_key" ON "WebhookLog"("webhookEventId");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "WebhookLog_webhookEventId_idx" ON "WebhookLog"("webhookEventId");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "WebhookLog_eventType_idx" ON "WebhookLog"("eventType");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "WebhookLog_status_idx" ON "WebhookLog"("status");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "WebhookLog_createdAt_idx" ON "WebhookLog"("createdAt");`, 'idx')
  // Add columns if table already existed without them
  await safeExec(`ALTER TABLE "WebhookLog" ADD COLUMN IF NOT EXISTS "error" TEXT;`, 'error col')
  await safeExec(`ALTER TABLE "WebhookLog" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`, 'updatedAt col')
  console.log('  ✅ WebhookLog table ready')

  // ─── FIX #5: UserPrompt & PromptResponse tables ──────────────
  console.log('[5/6] Creating UserPrompt and PromptResponse tables...')
  await safeExec(`
    CREATE TABLE IF NOT EXISTS "UserPrompt" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "questions" TEXT NOT NULL DEFAULT '[]',
      CONSTRAINT "UserPrompt_pkey" PRIMARY KEY ("id")
    );
  `, 'UserPrompt')
  
  await safeExec(`
    CREATE TABLE IF NOT EXISTS "PromptResponse" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "promptId" TEXT NOT NULL,
      "answers" TEXT NOT NULL DEFAULT '{}',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PromptResponse_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "PromptResponse_promptId_fkey" FOREIGN KEY ("promptId")
        REFERENCES "UserPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PromptResponse_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `, 'PromptResponse')

  await safeExec(`CREATE UNIQUE INDEX IF NOT EXISTS "PromptResponse_userId_promptId_key" ON "PromptResponse"("userId", "promptId");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "PromptResponse_userId_idx" ON "PromptResponse"("userId");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "PromptResponse_promptId_idx" ON "PromptResponse"("promptId");`, 'idx')
  console.log('  ✅ UserPrompt and PromptResponse tables ready')

  // ─── FIX #6: BundleOffering tables ──────────────────────────
  console.log('[6/7] Creating BundleOffering tables...')
  await safeExec(`
    CREATE TABLE IF NOT EXISTS "BundleOffering" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "recordedOriginalPrice" DOUBLE PRECISION,
      "recordedDiscountPrice" DOUBLE PRECISION,
      "liveOriginalPrice" DOUBLE PRECISION,
      "liveDiscountPrice" DOUBLE PRECISION,
      "allowIndividualPurchase" BOOLEAN NOT NULL DEFAULT true,
      CONSTRAINT "BundleOffering_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "BundleOffering_createdById_fkey" FOREIGN KEY ("createdById")
        REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `, 'BundleOffering')

  await safeExec(`CREATE INDEX IF NOT EXISTS "BundleOffering_createdById_idx" ON "BundleOffering"("createdById");`, 'idx')

  await safeExec(`
    CREATE TABLE IF NOT EXISTS "BundleOfferingCourse" (
      "id" TEXT NOT NULL,
      "bundleOfferingId" TEXT NOT NULL,
      "classId" TEXT NOT NULL,
      CONSTRAINT "BundleOfferingCourse_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "BundleOfferingCourse_bundleOfferingId_fkey" FOREIGN KEY ("bundleOfferingId")
        REFERENCES "BundleOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "BundleOfferingCourse_classId_fkey" FOREIGN KEY ("classId")
        REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `, 'BundleOfferingCourse')

  await safeExec(`CREATE UNIQUE INDEX IF NOT EXISTS "BundleOfferingCourse_bundleOfferingId_classId_key" ON "BundleOfferingCourse"("bundleOfferingId", "classId");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "BundleOfferingCourse_bundleOfferingId_idx" ON "BundleOfferingCourse"("bundleOfferingId");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "BundleOfferingCourse_classId_idx" ON "BundleOfferingCourse"("classId");`, 'idx')

  console.log('  ✅ BundleOffering tables ready')

  // ─── FIX #7: CourseOffering.detailsLink column ──────────────
  console.log('[7/8] Adding detailsLink to CourseOffering...')
  await safeExec(
    `ALTER TABLE "CourseOffering" ADD COLUMN IF NOT EXISTS "detailsLink" TEXT;`,
    'CourseOffering.detailsLink'
  )
  console.log('  ✅ CourseOffering.detailsLink column ready')

  // ─── VERIFICATION ─────────────────────────────────────────
  console.log('[7/7] Verifying fix...')
  try {
    const courseCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "Class"`)
    console.log(`  ✅ Course query works! Found ${courseCount[0].count} courses in database.`)
    const colCheck = await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'Class' AND column_name = 'liveUpgradePrice'
    `)
    console.log(colCheck.length > 0
      ? '  ✅ liveUpgradePrice column verified in database'
      : '  ⚠️  WARNING: liveUpgradePrice column not found')
  } catch (e) {
    console.error('  ❌ Verification failed:', e.message)
  }

  // ─── FIX #8: Bundle Discounts & Coupons ───────────────────
  console.log('[8/8] Adding Bundle Discounts & Coupon tables/columns...')
  
  // BundleOffering columns
  await safeExec(`ALTER TABLE "BundleOffering" ADD COLUMN IF NOT EXISTS "enableBundleDiscount" BOOLEAN NOT NULL DEFAULT false;`, 'BundleOffering.enableBundleDiscount')
  await safeExec(`ALTER TABLE "BundleOffering" ADD COLUMN IF NOT EXISTS "bundleDiscountType" TEXT;`, 'BundleOffering.bundleDiscountType')
  await safeExec(`ALTER TABLE "BundleOffering" ADD COLUMN IF NOT EXISTS "bundleDiscountValue" DOUBLE PRECISION;`, 'BundleOffering.bundleDiscountValue')
  await safeExec(`ALTER TABLE "BundleOffering" ADD COLUMN IF NOT EXISTS "bundleDiscountApplicability" TEXT;`, 'BundleOffering.bundleDiscountApplicability')
  await safeExec(`ALTER TABLE "BundleOffering" ADD COLUMN IF NOT EXISTS "requireAllCourses" BOOLEAN NOT NULL DEFAULT true;`, 'BundleOffering.requireAllCourses')
  
  // Order columns
  await safeExec(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "subtotalAmount" DOUBLE PRECISION;`, 'Order.subtotalAmount')
  await safeExec(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "bundleDiscountAmount" DOUBLE PRECISION DEFAULT 0;`, 'Order.bundleDiscountAmount')
  await safeExec(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponDiscountAmount" DOUBLE PRECISION DEFAULT 0;`, 'Order.couponDiscountAmount')
  await safeExec(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;`, 'Order.couponCode')
  await safeExec(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponId" TEXT;`, 'Order.couponId')

  // Champion Wrapper Fields
  await safeExec(`ALTER TABLE "BundleOffering" ADD COLUMN IF NOT EXISTS "championOriginalPrice" DOUBLE PRECISION;`, 'BundleOffering.championOriginalPrice')
  await safeExec(`ALTER TABLE "BundleOffering" ADD COLUMN IF NOT EXISTS "championDiscountPrice" DOUBLE PRECISION;`, 'BundleOffering.championDiscountPrice')
  await safeExec(`ALTER TABLE "BundleOffering" ADD COLUMN IF NOT EXISTS "championSubtitle" TEXT;`, 'BundleOffering.championSubtitle')

  await safeExec(`ALTER TABLE "CourseOffering" ADD COLUMN IF NOT EXISTS "championOriginalPrice" DOUBLE PRECISION;`, 'CourseOffering.championOriginalPrice')
  await safeExec(`ALTER TABLE "CourseOffering" ADD COLUMN IF NOT EXISTS "championDiscountPrice" DOUBLE PRECISION;`, 'CourseOffering.championDiscountPrice')
  await safeExec(`ALTER TABLE "CourseOffering" ADD COLUMN IF NOT EXISTS "championSubtitle" TEXT;`, 'CourseOffering.championSubtitle')

  // Enrollment Package Tracking
  await safeExec(`ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "packageName" TEXT;`, 'Enrollment.packageName')

  // Coupon Table
  await safeExec(`
    CREATE TABLE IF NOT EXISTS "Coupon" (
      "id" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "discountType" TEXT NOT NULL,
      "discountValue" DOUBLE PRECISION NOT NULL,
      "applicability" TEXT NOT NULL,
      "targetBundleIds" TEXT,
      "targetUserEmails" TEXT,
      "targetSubjects" TEXT,
      "minOrderValue" DOUBLE PRECISION,
      "isFirstPurchaseOnly" BOOLEAN NOT NULL DEFAULT false,
      "isSingleUsePerUser" BOOLEAN NOT NULL DEFAULT false,
      "isHidden" BOOLEAN NOT NULL DEFAULT false,
      "startDate" TIMESTAMP(3),
      "expiresAt" TIMESTAMP(3),
      "maxUses" INTEGER,
      "currentUses" INTEGER NOT NULL DEFAULT 0,
      "totalRevenueGenerated" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Coupon_createdById_fkey" FOREIGN KEY ("createdById")
        REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `, 'Coupon table')
  await safeExec(`CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "Coupon_code_idx" ON "Coupon"("code");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "Coupon_isActive_idx" ON "Coupon"("isActive");`, 'idx')

  // CouponUsage Table
  await safeExec(`
    CREATE TABLE IF NOT EXISTS "CouponUsage" (
      "id" TEXT NOT NULL,
      "couponId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "orderId" TEXT,
      "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CouponUsage_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "CouponUsage_couponId_fkey" FOREIGN KEY ("couponId")
        REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "CouponUsage_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `, 'CouponUsage table')
  await safeExec(`CREATE INDEX IF NOT EXISTS "CouponUsage_couponId_idx" ON "CouponUsage"("couponId");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "CouponUsage_userId_idx" ON "CouponUsage"("userId");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "CouponUsage_orderId_idx" ON "CouponUsage"("orderId");`, 'idx')

  console.log('  ✅ Bundle Discounts & Coupons schema ready')

  // ─── FIX #9: Store Notes & Mentorship ─────────────────────
  console.log('[9/9] Adding Store Notes & Mentorship tables...')
  
  // Store Notes
  await safeExec(`
    CREATE TABLE IF NOT EXISTS "StoreNote" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "originalPrice" DOUBLE PRECISION,
      "thumbnailUrl" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "StoreNote_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "StoreNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `, 'StoreNote')
  await safeExec(`CREATE INDEX IF NOT EXISTS "StoreNote_isActive_idx" ON "StoreNote"("isActive");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "StoreNote_createdById_idx" ON "StoreNote"("createdById");`, 'idx')

  await safeExec(`
    CREATE TABLE IF NOT EXISTS "StoreNoteFile" (
      "id" TEXT NOT NULL,
      "noteId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "fileUrl" TEXT NOT NULL,
      "fileType" TEXT NOT NULL DEFAULT 'LINK',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StoreNoteFile_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "StoreNoteFile_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "StoreNote"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `, 'StoreNoteFile')
  await safeExec(`CREATE INDEX IF NOT EXISTS "StoreNoteFile_noteId_idx" ON "StoreNoteFile"("noteId");`, 'idx')

  await safeExec(`
    CREATE TABLE IF NOT EXISTS "StoreNoteAccess" (
      "id" TEXT NOT NULL,
      "noteId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "orderId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StoreNoteAccess_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "StoreNoteAccess_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "StoreNote"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "StoreNoteAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `, 'StoreNoteAccess')
  await safeExec(`CREATE UNIQUE INDEX IF NOT EXISTS "StoreNoteAccess_noteId_userId_key" ON "StoreNoteAccess"("noteId", "userId");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "StoreNoteAccess_userId_idx" ON "StoreNoteAccess"("userId");`, 'idx')

  // Mentorship
  await safeExec(`
    CREATE TABLE IF NOT EXISTS "MentorshipOffering" (
      "id" TEXT NOT NULL,
      "mentorName" TEXT NOT NULL,
      "description" TEXT,
      "avatarUrl" TEXT,
      "pricePerSlot" DOUBLE PRECISION NOT NULL,
      "slotDuration" INTEGER NOT NULL DEFAULT 15,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "availableSlots" TEXT NOT NULL DEFAULT '[]',
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "MentorshipOffering_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "MentorshipOffering_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `, 'MentorshipOffering')
  await safeExec(`CREATE INDEX IF NOT EXISTS "MentorshipOffering_isActive_idx" ON "MentorshipOffering"("isActive");`, 'idx')

  await safeExec(`
    CREATE TABLE IF NOT EXISTS "MentorshipBooking" (
      "id" TEXT NOT NULL,
      "mentorshipId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "slotDate" TEXT NOT NULL,
      "slotTime" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "razorpayOrderId" TEXT,
      "orderId" TEXT,
      "userNote" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "MentorshipBooking_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "MentorshipBooking_mentorshipId_fkey" FOREIGN KEY ("mentorshipId") REFERENCES "MentorshipOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "MentorshipBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `, 'MentorshipBooking')
  await safeExec(`CREATE UNIQUE INDEX IF NOT EXISTS "MentorshipBooking_mentorshipId_slotDate_slotTime_key" ON "MentorshipBooking"("mentorshipId", "slotDate", "slotTime");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "MentorshipBooking_userId_idx" ON "MentorshipBooking"("userId");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "MentorshipBooking_mentorshipId_idx" ON "MentorshipBooking"("mentorshipId");`, 'idx')

  console.log('  ✅ Store Notes & Mentorship tables ready')

  // ─── FIX #10: Test Series ─────────────────────────────────
  console.log('[10/10] Adding Test Series tables...')

  await safeExec(`
    CREATE TABLE IF NOT EXISTS "TestSeries" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "originalPrice" DOUBLE PRECISION,
      "validityDays" INTEGER NOT NULL DEFAULT 365,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TestSeries_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "TestSeries_createdById_fkey" FOREIGN KEY ("createdById")
        REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `, 'TestSeries')
  await safeExec(`CREATE INDEX IF NOT EXISTS "TestSeries_isActive_idx" ON "TestSeries"("isActive");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "TestSeries_createdById_idx" ON "TestSeries"("createdById");`, 'idx')

  await safeExec(`
    CREATE TABLE IF NOT EXISTS "TestSeriesAccess" (
      "id" TEXT NOT NULL,
      "testSeriesId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "orderId" TEXT,
      "razorpayPaymentId" TEXT,
      "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TestSeriesAccess_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "TestSeriesAccess_testSeriesId_fkey" FOREIGN KEY ("testSeriesId")
        REFERENCES "TestSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "TestSeriesAccess_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `, 'TestSeriesAccess')
  await safeExec(`CREATE UNIQUE INDEX IF NOT EXISTS "TestSeriesAccess_testSeriesId_userId_key" ON "TestSeriesAccess"("testSeriesId", "userId");`, 'idx')
  await safeExec(`CREATE INDEX IF NOT EXISTS "TestSeriesAccess_userId_idx" ON "TestSeriesAccess"("userId");`, 'idx')

  // Add testSeriesId column to Exam table
  await safeExec(`ALTER TABLE "Exam" ALTER COLUMN "classId" DROP NOT NULL;`, 'Exam.classId nullable')
  await safeExec(`ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "testSeriesId" TEXT;`, 'Exam.testSeriesId')
  await safeExec(`ALTER TABLE "Exam" ADD CONSTRAINT "Exam_testSeriesId_fkey" FOREIGN KEY ("testSeriesId") REFERENCES "TestSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;`, 'Exam.testSeriesId fkey')
  await safeExec(`CREATE INDEX IF NOT EXISTS "Exam_testSeriesId_idx" ON "Exam"("testSeriesId");`, 'idx')

  console.log('  ✅ Test Series tables ready')

  console.log('\n╔═══════════════════════════════════════════════════╗')
  console.log('║   ✅ SCHEMA SYNC COMPLETE                        ║')
  console.log('║   Restart the app: pm2 restart all               ║')
  console.log('╚═══════════════════════════════════════════════════╝\n')

}

main()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
