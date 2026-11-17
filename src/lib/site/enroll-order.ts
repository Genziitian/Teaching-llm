import type { NextRequest } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { siteDb } from '@/lib/site/store-courses'
import { findProfileByEmail } from '@/lib/site/profile'
import { getEnrollUrl } from '@/lib/site/enroll-url'
import { escapeLike } from '@/lib/site/http'
import { getCourseSummary, sendToGoogleSheet } from '@/lib/site/google-sheet'

export interface EnrollOrderInput {
  razorpayOrderId: string
  razorpayPaymentId: string
  // Nothing else is accepted: email, courses, coupon, referral, coins, class type and price are
  // read ONLY from the stored website_orders row (written server-side by create-order).
}

export interface EnrollOrderResult {
  success: boolean
  alreadyProcessed?: boolean
  notFound?: boolean
  error?: string
}

function parseBundleCourses(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * Port of the storefront server's enrollUserInLMS (server/index.js), shared by verify-payment and the
 * Razorpay webhook. Atomically claims the order (CREATED -> PAID) so that whichever caller wins runs
 * every side effect exactly once and the other gets { alreadyProcessed: true }. Then enrolls the buyer through the class external-enroll
 * webhook, logs to the Google Sheet, records coupon usage, credits the referrer and deducts the
 * buyer's coins. Each step after the PAID claim is isolated so one failure never blocks the rest.
 */
export async function enrollPaidStorefrontOrder(request: NextRequest, input: EnrollOrderInput): Promise<EnrollOrderResult> {
  const supabase = siteDb()
  const orderId = input.razorpayOrderId
  const paymentId = input.razorpayPaymentId

  // 1. Idempotency: read the order, then atomically claim it (only one caller can flip CREATED -> PAID).
  const { data: existingOrder, error: orderError } = await supabase
    .from('website_orders')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle()
  if (orderError) throw orderError
  if (!existingOrder) return { success: false, notFound: true, error: 'Order not found' }
  if (existingOrder.status === 'PAID') return { success: true, alreadyProcessed: true }

  const { data: claimed, error: claimError } = await supabase
    .from('website_orders')
    .update({ status: 'PAID' })
    .eq('order_id', orderId)
    .eq('status', 'CREATED')
    .select('order_id')
  if (claimError) throw claimError
  if (!claimed || claimed.length === 0) return { success: true, alreadyProcessed: true }

  const email = String(existingOrder.user_email || '').trim().toLowerCase()
  const courseIds: string[] = Array.isArray(existingOrder.course_ids) ? existingOrder.course_ids : []
  const referralCode: string | null = existingOrder.referral_code || null
  const discountCode: string | null = existingOrder.discount_code || null
  const coinsApplied = Math.max(Number(existingOrder.coins_applied || 0) || 0, 0)
  const selectedClassType: string | null = existingOrder.selected_class_type || null
  const resolvedPrice = Number(existingOrder.total_amount || 0) || 0

  if (!email) {
    console.error('[site:enroll-order] Order has no buyer email:', orderId)
    return { success: false, error: 'Order has no buyer email' }
  }

  const profile = await findProfileByEmail(email, 'id, name, phone, gender')

  // === STEP 1: LMS ENROLLMENT (isolated: failures must NOT block referral/coin processing) ===
  let lmsEnrollmentSucceeded = false
  let lmsError: string | undefined
  let lmsCourseDetails: { id: string; type?: string }[] = []
  try {
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('id, class_type, bundleCourses')
      .in('id', courseIds.length > 0 ? courseIds : ['__none__'])
    if (coursesError) throw coursesError

    // Translate website slugs to LMS course IDs (bundles expand to their member courses)
    const lmsCourseIds: string[] = courseIds.flatMap((id) => {
      const dbCourse = coursesData?.find((c: any) => c.id === id)
      const bundleCourses = parseBundleCourses(dbCourse?.bundleCourses)
      if (bundleCourses.length > 0) {
        return bundleCourses.map((bc: any) => bc?.courseId).filter(Boolean)
      }
      return [id]
    })

    lmsCourseDetails = lmsCourseIds.map((lmsId) => {
      const parentCourse = coursesData?.find((c: any) => {
        if (c.id === lmsId) return true
        return parseBundleCourses(c.bundleCourses).some((bc: any) => bc?.courseId === lmsId)
      })
      const rawType = selectedClassType || parentCourse?.class_type
      return { id: lmsId, ...(rawType ? { type: String(rawType).toUpperCase() } : {}) }
    })

    const lmsRes = await fetch(getEnrollUrl(request), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        secret: process.env.EXTERNAL_ENROLL_SECRET,
        email,
        name: profile?.name || 'Student',
        phone: profile?.phone || 'N/A',
        gender: profile?.gender || 'MALE',
        orderId,
        paymentId,
        purchasedAt: existingOrder.created_at || new Date().toISOString(),
        finalPrice: resolvedPrice,
        courseIds: lmsCourseIds,
        courseDetails: lmsCourseDetails,
        courseId: lmsCourseIds[0] || null,
      }),
    })

    if (!lmsRes.ok) {
      throw new Error((await lmsRes.text()) || `Enroll webhook returned ${lmsRes.status}`)
    }

    lmsEnrollmentSucceeded = true

    const successLogs = courseIds.map((cid) => {
      const matchedDetail = lmsCourseDetails.find((c) => c.id === cid)
      return {
        userId: profile?.id,
        email,
        action: 'ENROLLMENT_SUCCESS',
        courseId: cid,
        created_at: new Date().toISOString(),
        metadata: {
          order_id: orderId,
          payment_id: paymentId,
          source: 'system',
          class_type: matchedDetail?.type || selectedClassType,
        },
      }
    })
    if (successLogs.length > 0) await supabase.from('activity_logs').insert(successLogs)
  } catch (err) {
    lmsError = String(err)
    console.error('[site:enroll-order] LMS enrollment error:', lmsError)
    try {
      const failureLogs = courseIds.map((cid) => ({
        userId: profile?.id,
        email,
        action: 'ENROLLMENT_FAILURE',
        courseId: cid,
        created_at: new Date().toISOString(),
        metadata: { error: lmsError, order_id: orderId },
      }))
      if (failureLogs.length > 0) await supabase.from('activity_logs').insert(failureLogs)
    } catch (logErr) {
      console.error('[site:enroll-order] Failed to log enrollment failure:', (logErr as any)?.message || 'unknown')
    }
  }

  // === STEP 2: GOOGLE SHEETS LOGGING (runs regardless of LMS result) ===
  try {
    const { courseNames, classTypes } = await getCourseSummary(courseIds)
    await sendToGoogleSheet({
      name: profile?.name || 'Student',
      email,
      phone: profile?.phone || 'N/A',
      course_name: courseNames,
      price: Number(existingOrder.total_amount || 0),
      status: lmsEnrollmentSucceeded ? 'SUCCESS' : 'ENROLLMENT_FAILED',
      payment_id: paymentId,
      order_id: orderId,
      referral_code: existingOrder.referral_code || 'N/A',
      discount_code: existingOrder.discount_code || 'N/A',
      coins_applied: coinsApplied,
      class_type: selectedClassType || classTypes,
    })
  } catch (sheetErr) {
    console.error('[site:enroll-order] Sheet logging error (non-fatal):', (sheetErr as any)?.message || 'unknown')
  }

  // === STEP 3: RECORD COUPON USAGE (runs regardless of LMS result) ===
  if (discountCode) {
    try {
      const codeToApply = String(discountCode).trim().toUpperCase()
      const { data: coupon } = await supabase
        .from('discount_coupons')
        .select('code, used_count, single_use_per_user')
        .eq('code', codeToApply)
        .maybeSingle()

      if (coupon) {
        if (coupon.single_use_per_user !== false) {
          await supabase
            .from('coupon_uses')
            .upsert({ code: coupon.code, user_email: email, order_id: orderId }, { onConflict: 'code,user_email' })
        }
        await supabase
          .from('discount_coupons')
          .update({ used_count: Number(coupon.used_count || 0) + 1 })
          .eq('code', coupon.code)
      }
    } catch (couponErr) {
      console.error('[site:enroll-order] Coupon usage tracking error (non-fatal):', (couponErr as any)?.message || 'unknown')
    }
  }

  // === STEP 4: REFERRAL REWARD PROCESSING (runs regardless of LMS result) ===
  if (referralCode) {
    try {
      const codeToCheck = String(referralCode).trim().toUpperCase()
      const { data: referrerProfile, error: rpErr } = await supabase
        .from('referral_profiles')
        .select('*')
        .eq('referral_code', codeToCheck)
        .maybeSingle()
      if (rpErr) throw rpErr

      if (!referrerProfile) {
        console.log(`[Referral] Code ${codeToCheck} not found.`)
      } else if (String(referrerProfile.email || '').toLowerCase() === email) {
        console.log('[Referral] Buyer using own code. Skipping.')
      } else {
        const finalPrice = Number(existingOrder.total_amount || 0)
        if (finalPrice <= 0) {
          throw new Error(`Order amount not found for reward calculation: ${orderId}`)
        }

        const referrerReward = Math.floor(finalPrice * 0.05) // 5% of what was paid
        const originalPrice = Number(existingOrder.original_amount || 0) || Math.ceil(finalPrice / 0.95)
        const buyerDiscount =
          existingOrder.discount_amount !== undefined && existingOrder.discount_amount !== null
            ? Number(existingOrder.discount_amount)
            : originalPrice - finalPrice

        const newBalance = (referrerProfile.wallet_balance || 0) + referrerReward
        const newLifetime = (referrerProfile.lifetime_referrals || 0) + 1
        const newQuarterly = (referrerProfile.quarterly_referrals || 0) + 1

        const { data: milestones, error: msErr } = await supabase
          .from('referral_milestones')
          .select('*')
          .order('referrals_required', { ascending: true })
        if (msErr) throw msErr

        let milestoneBonus = 0
        for (const ms of milestones || []) {
          if (newQuarterly >= ms.referrals_required && (referrerProfile.quarterly_referrals || 0) < ms.referrals_required) {
            milestoneBonus += ms.bonus_coins
          }
        }

        const { error: updateErr } = await supabase
          .from('referral_profiles')
          .update({
            wallet_balance: newBalance + milestoneBonus,
            lifetime_referrals: newLifetime,
            quarterly_referrals: newQuarterly,
          })
          .eq('id', referrerProfile.id)
        if (updateErr) throw updateErr

        const { error: txnErr } = await supabase.from('referral_transactions').insert({
          referrer_email: referrerProfile.email,
          buyer_email: email,
          referral_code: codeToCheck,
          order_id: orderId,
          original_price: originalPrice,
          buyer_discount: buyerDiscount,
          final_price: finalPrice,
          referrer_reward: referrerReward + milestoneBonus,
          coins_used: coinsApplied,
        })
        if (txnErr) throw txnErr
      }
    } catch (referralErr) {
      console.error('[site:enroll-order] Referral processing error (non-fatal):', (referralErr as any)?.message || 'unknown')
    }
  }

  // === STEP 5: DEDUCT BUYER COINS (runs regardless of LMS result) ===
  if (coinsApplied > 0) {
    try {
      const { data: buyerRef } = await supabase
        .from('referral_profiles')
        .select('id, wallet_balance')
        .ilike('email', escapeLike(email))
        .limit(1)
        .maybeSingle()

      if (buyerRef) {
        const newBal = Math.max((buyerRef.wallet_balance || 0) - coinsApplied, 0)
        await supabase.from('referral_profiles').update({ wallet_balance: newBal }).eq('id', buyerRef.id)
      }
    } catch (coinErr) {
      console.error('[site:enroll-order] Coin deduction error (non-fatal):', (coinErr as any)?.message || 'unknown')
    }
  }

  return { success: lmsEnrollmentSucceeded, ...(lmsError ? { error: lmsError } : {}) }
}
