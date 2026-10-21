import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import Razorpay from 'razorpay'
import { checkCoupon, roundForPlay } from '@/lib/coupon-rules'
import { getAppCouponsEnabled } from '@/lib/app-flags'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID!, key_secret: process.env.RAZORPAY_KEY_SECRET! })

    const body = await request.json()
    // body: { buyAll: boolean, accessType: 'RECORDED'|'LIVE'|'CHAMPION', selectedCourseIds?: string[], perCourseAccessTypes?: Record<string,string>, couponCode?: string }
    const { buyAll, accessType, selectedCourseIds, perCourseAccessTypes } = body
    // Google Play purchases use fixed ₹10-step Play products: discounts are rounded up to the next ₹10 below.
    const playMode = body.playMode === true
    // App coupons (and the ₹10 round-up that goes with them) only run while the manager switch is ON.
    const appCouponsOn = playMode ? await getAppCouponsEnabled() : true
    const couponCode = playMode && !appCouponsOn ? null : body.couponCode

    if (!['RECORDED', 'LIVE', 'CHAMPION'].includes(accessType)) return NextResponse.json({ error: 'Invalid access type' }, { status: 400 })

    const bundle = await prisma.bundleOffering.findUnique({ where: { id: params.id }, include: { courses: { include: { course: true } } } })
    if (!bundle) return NextResponse.json({ error: 'Bundle not found' }, { status: 404 })

    // Fixed bundle check: if individual purchase not allowed, must buy all
    if (!bundle.allowIndividualPurchase && !buyAll) {
      return NextResponse.json({ error: 'This is a fixed bundle. You must purchase all courses together.' }, { status: 400 })
    }

    // Determine which courses to charge for
    let courseEntries: Array<{ courseId: string; accessType: string; price: number }> = []
    const tierPrices = bundle.coursePrices ? JSON.parse(bundle.coursePrices) : {}
    const isFixed = bundle.allowIndividualPurchase === false
    const individualMapping = tierPrices.individualMapping || {}
    const hasIndividualMapping = Object.keys(individualMapping).length > 0

    const selectedList = buyAll ? bundle.courses.map(bc => bc.course.id) : (Array.isArray(selectedCourseIds) && selectedCourseIds.length ? selectedCourseIds : [])
    if (selectedList.length === 0) return NextResponse.json({ error: 'No courses selected' }, { status: 400 })

    const count = selectedList.length
    const tier = tierPrices[count]

    for (const cid of selectedList) {
      const perType = perCourseAccessTypes && perCourseAccessTypes[cid] ? perCourseAccessTypes[cid] : accessType
      let price = 0

      if (isFixed) {
        // Fixed bundle: use global bundle price fields, distributed across courses
        const bundlePrice = perType === 'RECORDED'
          ? bundle.recordedDiscountPrice ?? bundle.recordedOriginalPrice
          : perType === 'CHAMPION'
            ? bundle.championDiscountPrice ?? bundle.championOriginalPrice ?? bundle.liveDiscountPrice ?? bundle.liveOriginalPrice
            : bundle.liveDiscountPrice ?? bundle.liveOriginalPrice
        price = (Number(bundlePrice) || 0) / count
      } else if (hasIndividualMapping && individualMapping[cid]) {
        // Non-fixed with subject-specific pricing
        const custom = individualMapping[cid]
        if (perType === 'RECORDED') {
          price = Number(custom.recorded || 0)
        } else if (perType === 'CHAMPION') {
          price = Number(custom.champion || custom.live || 0)
        } else {
          price = Number(custom.live || 0)
        }
      } else if (tier) {
        // Tiered pricing (tier[count] = bundle total for N courses)
        const tierVal = perType === 'RECORDED'
          ? (tier.recordedDiscount || tier.recordedOriginal || 0)
          : perType === 'CHAMPION'
            ? (tier.championDiscount || tier.championOriginal || tier.liveDiscount || tier.liveOriginal || 0)
            : (tier.liveDiscount || tier.liveOriginal || 0)
        price = Number(tierVal) / count
      } else {
        // Fallback: sum individual offering prices
        const offering = await prisma.courseOffering.findFirst({ where: { courseId: cid }, orderBy: { createdAt: 'desc' } })
        if (perType === 'RECORDED') {
          price = offering?.recordedDiscountPrice ?? offering?.recordedOriginalPrice ?? 0
        } else if (perType === 'CHAMPION') {
          price = offering?.championDiscountPrice ?? offering?.championOriginalPrice ?? offering?.liveDiscountPrice ?? offering?.liveOriginalPrice ?? 0
        } else {
          price = offering?.liveDiscountPrice ?? offering?.liveOriginalPrice ?? 0
        }
      }

      courseEntries.push({ courseId: cid, accessType: perType, price })
    }

    // ── Calculate subtotal ──
    const subtotal = courseEntries.reduce((s, it) => s + (it.price || 0), 0)

    // ── Apply bundle discount (first priority) ──
    let bundleDiscountAmount = 0
    if (bundle.enableBundleDiscount && bundle.bundleDiscountValue) {
      // Check applicability
      const applicability = bundle.bundleDiscountApplicability || 'BOTH'
      
      // For mixed bundles, we check if the "dominant" type matches or if it's BOTH
      const liveCount = courseEntries.filter(e => e.accessType === 'LIVE').length
      const recordedCount = courseEntries.filter(e => e.accessType === 'RECORDED').length
      const dominantType = liveCount >= recordedCount ? 'LIVE' : 'RECORDED'

      const accessMatchesApplicability = applicability === 'BOTH' || applicability === dominantType

      // Check requireAllCourses
      const allCoursesSelected = buyAll || (courseEntries.length === bundle.courses.length)
      const meetsRequireAll = !bundle.requireAllCourses || allCoursesSelected

      if (accessMatchesApplicability && meetsRequireAll) {
        if (bundle.bundleDiscountType === 'PERCENTAGE') {
          bundleDiscountAmount = Math.round((subtotal * bundle.bundleDiscountValue) / 100)
        } else if (bundle.bundleDiscountType === 'FIXED') {
          bundleDiscountAmount = bundle.bundleDiscountValue
        }
        bundleDiscountAmount = Math.min(bundleDiscountAmount, subtotal)
      }
    }

    const afterBundleDiscount = subtotal - bundleDiscountAmount

    // ── Apply coupon discount (second priority) ──
    let couponDiscountAmount = 0
    let appliedCouponId: string | null = null
    let appliedCouponCode: string | null = null

    if (couponCode && playMode) {
      const checked = await checkCoupon({
        code: couponCode,
        userId: session.userId,
        email: session.email,
        bundleOfferingId: params.id,
        courseIds: courseEntries.map(e => e.courseId),
        accessTypes: courseEntries.map(e => e.accessType),
        subtotal: afterBundleDiscount,
      })
      if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: checked.status })
      couponDiscountAmount = checked.discountAmount
      appliedCouponId = checked.coupon.id
      appliedCouponCode = checked.coupon.code
    } else if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } })

      if (coupon && coupon.isActive) {
        // CRITICAL: Live Bundle Coupon Validation
        // If the coupon code contains "LIVE", all selected courses MUST be "LIVE"
        const isLiveCoupon = coupon.code.includes('LIVE')
        const allLive = courseEntries.every(e => e.accessType === 'LIVE')
        
        if (isLiveCoupon && !allLive) {
          return NextResponse.json({ error: 'This LIVE coupon requires all subjects in the bundle to be set to LIVE.' }, { status: 400 })
        }

        // Validate dates
        const now = new Date()
        const startOk = !coupon.startDate || now >= new Date(coupon.startDate)
        const expiryOk = !coupon.expiresAt || now <= new Date(coupon.expiresAt)
        const usageOk = coupon.maxUses == null || coupon.currentUses < coupon.maxUses

        // Single use per user check
        let singleUseOk = true
        if (coupon.isSingleUsePerUser) {
          const existing = await prisma.couponUsage.findFirst({ where: { couponId: coupon.id, userId: session.userId } })
          if (existing) singleUseOk = false
        }

        // First purchase only check
        let firstPurchaseOk = true
        if (coupon.isFirstPurchaseOnly) {
          const existing = await prisma.order.findFirst({ where: { userId: session.userId, status: 'PAID' } })
          if (existing) firstPurchaseOk = false
        }

        // User email check
        let emailOk = true
        if (coupon.targetUserEmails) {
          try {
            const emails: string[] = JSON.parse(coupon.targetUserEmails)
            if (emails.length > 0 && !emails.includes(session.email)) emailOk = false
          } catch { /* skip */ }
        }

        // Bundle targeting check
        let bundleOk = true
        if (coupon.applicability === 'BUNDLE' && coupon.targetBundleIds) {
          try {
            const bundleIds: string[] = JSON.parse(coupon.targetBundleIds)
            if (bundleIds.length > 0 && !bundleIds.includes(params.id)) bundleOk = false
          } catch { /* skip */ }
        }

        // Min order value (checked against afterBundleDiscount)
        const minValueOk = coupon.minOrderValue == null || afterBundleDiscount >= coupon.minOrderValue

        if (startOk && expiryOk && usageOk && singleUseOk && firstPurchaseOk && emailOk && bundleOk && minValueOk) {
          if (coupon.discountType === 'PERCENTAGE') {
            couponDiscountAmount = Math.round((afterBundleDiscount * coupon.discountValue) / 100)
          } else if (coupon.discountType === 'FIXED') {
            couponDiscountAmount = coupon.discountValue
          }
          if (coupon.maxDiscount != null && coupon.maxDiscount > 0) couponDiscountAmount = Math.min(couponDiscountAmount, coupon.maxDiscount)
          couponDiscountAmount = Math.min(couponDiscountAmount, afterBundleDiscount)
          appliedCouponId = coupon.id
          appliedCouponCode = coupon.code
        }
      }
    }

    // ── Final amount ──
    let finalAmount = Math.max(0, afterBundleDiscount - couponDiscountAmount)
    if (playMode && appCouponsOn) {
      // Round up to the next ₹10 (Play product ladder); the extra is taken back from the discount.
      const rounded = roundForPlay(subtotal, finalAmount, bundleDiscountAmount + couponDiscountAmount > 0)
      let extra = rounded - finalAmount
      const fromCoupon = Math.min(extra, couponDiscountAmount)
      couponDiscountAmount -= fromCoupon
      extra -= fromCoupon
      bundleDiscountAmount = Math.max(0, bundleDiscountAmount - extra)
      finalAmount = rounded
    }
    const totalAmountPaise = Math.round(finalAmount * 100)

    // Create pending order with discount tracking
    const order = await prisma.order.create({
      data: {
        userId: session.userId,
        amount: finalAmount,
        subtotalAmount: subtotal,
        bundleDiscountAmount,
        couponDiscountAmount,
        couponCode: appliedCouponCode,
        couponId: appliedCouponId,
        status: 'PENDING',
        items: {
          create: courseEntries.map(it => ({
            courseId: it.courseId,
            accessType: it.accessType,
            price: it.price
          }))
        }
      },
      include: { items: true }
    })

    // If total is 0 (free via discounts), mark as paid directly
    if (totalAmountPaise === 0) {
      // Record coupon usage
      if (appliedCouponId) {
        await prisma.$transaction([
          prisma.coupon.update({ where: { id: appliedCouponId }, data: { currentUses: { increment: 1 } } }),
          prisma.couponUsage.create({ data: { couponId: appliedCouponId, userId: session.userId, orderId: order.id, revenue: 0 } }),
          prisma.order.update({ where: { id: order.id }, data: { status: 'PAID' } })
        ])
      } else {
        await prisma.order.update({ where: { id: order.id }, data: { status: 'PAID' } })
      }

      // Enroll user in courses
      for (const entry of courseEntries) {
        const isChampion = entry.accessType === 'CHAMPION';
        const enrollmentType = isChampion ? 'LIVE' : entry.accessType;
        const packageName = isChampion ? 'CHAMPION' : null;

        await prisma.enrollment.upsert({
          where: { userId_courseId: { userId: session.userId, courseId: entry.courseId } },
          update: { type: enrollmentType as any, packageName },
          create: { userId: session.userId, courseId: entry.courseId, type: enrollmentType as any, packageName }
        })
      }

      return NextResponse.json({
        orderId: order.id,
        freeCheckout: true,
        amount: 0,
        subtotal,
        bundleDiscountAmount,
        couponDiscountAmount,
        bundleName: bundle.name
      })
    }

    if (playMode) {
      return NextResponse.json({
        orderId: order.id,
        amount: totalAmountPaise,
        amountRupees: finalAmount,
        playProductId: `course_${Math.round(finalAmount)}`,
        subtotal,
        bundleDiscountAmount,
        couponDiscountAmount,
        couponCode: appliedCouponCode,
        bundleName: bundle.name
      })
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmountPaise,
      currency: 'INR',
      receipt: order.id,
      notes: {
        orderId: order.id,
        bundleId: params.id,
        userId: session.userId,
        userName: session.name || 'Student',
        type: 'BUNDLE_PURCHASE',
        couponCode: appliedCouponCode || '',
        couponId: appliedCouponId || ''
      }
    })

    await prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId: razorpayOrder.id } })

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmountPaise,
      subtotal,
      bundleDiscountAmount,
      couponDiscountAmount,
      currency: 'INR',
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      bundleName: bundle.name,
      userName: session.name,
      userEmail: session.email
    })
  } catch (error: any) {
    console.error('[bundle create-order] Error:', error)
    const debugMsg = error?.message || 'Unknown error'
    const debugMeta = error?.meta ? JSON.stringify(error.meta) : ''
    const debugCode = error?.code || ''
    return NextResponse.json({ 
      error: 'Internal server error', 
      debug: `${debugCode}: ${debugMsg} ${debugMeta}`.trim()
    }, { status: 500 })
  }
}
