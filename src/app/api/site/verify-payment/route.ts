import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { getStorefrontRazorpaySecret } from '@/lib/site/razorpay'
import { findProfileByEmail } from '@/lib/site/profile'
import { getEnrollUrl } from '@/lib/site/enroll-url'
import { readBody, jsonRes } from '@/lib/site/http'

export const dynamic = 'force-dynamic'

async function sendToGoogleSheet(payload: Record<string, any>) {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!url) {
    console.warn('[verify-payment] GOOGLE_SHEET_WEBHOOK_URL not set, skipping GSheet log.');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout for serverless

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
      signal: controller.signal,
    });
  } catch (err: any) {
    console.error('[verify-payment] Google Sheet log error:', err.message);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const res = jsonRes();

  try {
    const supabase = storefrontDb();
    const razorpaySecret = getStorefrontRazorpaySecret();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      email,
      courseIds,
      discountCode,
      referralCode,
      coinsToApply,
      coinsApplied, // Keep both for backwards compatibility during deploys
      selectedClassType,
    } = await readBody(request);

    const actualCoinsApplied = coinsToApply !== undefined ? coinsToApply : (coinsApplied || 0);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !email || !Array.isArray(courseIds)) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(body)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const signatureBuf = Buffer.from(razorpay_signature || '', 'utf8');
    if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
      return res.status(400).json({ error: 'Signature mismatch' });
    }

    // Fetch order first to enforce verified server-side email and course IDs (prevent parameter tampering)
    let orderData: any = null;
    const orderWithClassType = await supabase
      .from('website_orders')
      .select('user_email, course_ids, total_amount, created_at, selected_class_type')
      .eq('order_id', razorpay_order_id)
      .single();

    if (orderWithClassType.error?.code === 'PGRST204' && orderWithClassType.error.message?.includes('selected_class_type')) {
      const orderWithoutClassType = await supabase
        .from('website_orders')
        .select('user_email, course_ids, total_amount, created_at')
        .eq('order_id', razorpay_order_id)
        .single();

      if (orderWithoutClassType.error) {
        throw orderWithoutClassType.error;
      }
      orderData = orderWithoutClassType.data;
    } else if (orderWithClassType.error) {
      throw orderWithClassType.error;
    } else {
      orderData = orderWithClassType.data;
    }

    if (!orderData) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const verifiedEmail = (orderData.user_email || email).trim().toLowerCase();
    const verifiedCourseIds = Array.isArray(orderData.course_ids) && orderData.course_ids.length > 0
      ? orderData.course_ids
      : courseIds;

    const { error: orderUpdateError } = await supabase
      .from('website_orders')
      .update({ status: 'PAID' })
      .eq('order_id', razorpay_order_id);

    if (orderUpdateError) {
      throw orderUpdateError;
    }

    const profile = await findProfileByEmail(verifiedEmail, 'id, name, phone, gender');

    const lmsEnrollUrl = getEnrollUrl(request);
    const externalEnrollSecret = process.env.EXTERNAL_ENROLL_SECRET;

    // === STEP 1: LMS ENROLLMENT (isolated — failures here must NOT block referral/coin processing) ===
    // Fetch course details for class types and LMS IDs
    const { data: coursesData } = await supabase.from('courses').select('id, class_type, bundleCourses').in('id', verifiedCourseIds);
    
    // Translate website slugs to LMS course IDs
    const lmsCourseIds = verifiedCourseIds.flatMap((id: string) => {
      const dbCourse = coursesData?.find(c => c.id === id);
      if (dbCourse) {
        let bundleCourses = dbCourse.bundleCourses;
        if (typeof bundleCourses === 'string') {
          try {
            bundleCourses = JSON.parse(bundleCourses);
          } catch (e) {
            bundleCourses = [];
          }
        }
        if (Array.isArray(bundleCourses) && bundleCourses.length > 0) {
          return bundleCourses.map((bc: any) => bc.courseId).filter(Boolean);
        }
      }
      return [id]; // Fallback to slug if not configured
    });

    // Use only class types provided by the website/order data. Do not invent a default type.
    const lmsCourseDetails = lmsCourseIds.map(lmsId => {
      const parentCourse = coursesData?.find(c => {
        if (c.id === lmsId) return true;
        let bundleCourses = c.bundleCourses;
        if (typeof bundleCourses === 'string') {
          try {
            bundleCourses = JSON.parse(bundleCourses);
          } catch (e) {
            bundleCourses = [];
          }
        }
        if (Array.isArray(bundleCourses)) {
          return bundleCourses.some((bc: any) => bc.courseId === lmsId);
        }
        return false;
      });
      const rawType = orderData?.selected_class_type || selectedClassType || parentCourse?.class_type;
      return {
        id: lmsId,
        ...(rawType ? { type: String(rawType).toUpperCase() } : {})
      };
    });

    let lmsEnrollmentSucceeded = false;
    try {
      const lmsRes = await fetch(lmsEnrollUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({
          secret: externalEnrollSecret,
          email: verifiedEmail,
          name: profile?.name || 'Student',
          phone: profile?.phone || 'N/A',
          gender: profile?.gender || 'MALE',
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          purchasedAt: orderData?.created_at || new Date().toISOString(),
          finalPrice: orderData?.total_amount || 0,
          courseIds: lmsCourseIds,
          courseDetails: lmsCourseDetails,
          courseId: lmsCourseIds[0] || null
        }),
      });

      if (!lmsRes.ok) {
        throw new Error(await lmsRes.text());
      }

      lmsEnrollmentSucceeded = true;

      const successLogs = verifiedCourseIds.map((courseId: string) => ({
        userId: profile?.id,
        email: verifiedEmail,
        action: 'ENROLLMENT_SUCCESS',
        courseId,
        created_at: new Date().toISOString(),
        metadata: {
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
        },
      }));

      await supabase.from('activity_logs').insert(successLogs);
    } catch (lmsError) {
      console.error('LMS enrollment error:', String(lmsError));

      const failureLogs = verifiedCourseIds.map((courseId: string) => ({
        userId: profile?.id,
        email: verifiedEmail,
        action: 'ENROLLMENT_FAILURE',
        courseId,
        created_at: new Date().toISOString(),
        metadata: { error: String(lmsError) },
      }));

      await supabase.from('activity_logs').insert(failureLogs);
    }

    // === STEP 1b: GOOGLE SHEET LOGGING (runs regardless of LMS result) ===
    try {
      // Fetch course names for the sheet log
      const { data: coursesForLog } = await supabase.from('courses').select('id, name, class_type').in('id', courseIds);
      const courseNames = coursesForLog && coursesForLog.length > 0
        ? Array.from(new Set(coursesForLog.map(c => c.name))).join(', ')
        : 'Unknown Course';
      const classTypesStr = coursesForLog && coursesForLog.length > 0
        ? Array.from(new Set(coursesForLog.map(c => c.class_type).filter(Boolean))).join(', ')
        : '';

      // Fetch order details for price
      const { data: orderForLog } = await supabase.from('website_orders')
        .select('total_amount, referral_code, discount_code, coins_applied')
        .eq('order_id', razorpay_order_id).single();

      await sendToGoogleSheet({
        name: profile?.name || 'Student',
        email: verifiedEmail,
        phone: profile?.phone || 'N/A',
        course_name: courseNames,
        price: orderForLog?.total_amount || 0,
        status: lmsEnrollmentSucceeded ? 'SUCCESS' : 'ENROLLMENT_FAILED',
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        referral_code: orderForLog?.referral_code || referralCode || 'N/A',
        discount_code: orderForLog?.discount_code || discountCode || 'N/A',
        coins_applied: orderForLog?.coins_applied || actualCoinsApplied || 0,
        class_type: selectedClassType || classTypesStr,
      });
    } catch (sheetErr) {
      console.error('[verify-payment] Sheet logging error (non-fatal):', (sheetErr as any)?.message || 'unknown');
    }

    // === STEP 2: RECORD COUPON USAGE (runs regardless of LMS result) ===
    if (discountCode) {
      try {
        const codeToApply = String(discountCode).trim().toUpperCase();
        const { data: coupon } = await supabase
          .from('discount_coupons')
          .select('code, used_count, single_use_per_user')
          .eq('code', codeToApply)
          .maybeSingle();

        if (coupon) {
          if (coupon.single_use_per_user !== false) {
            await supabase.from('coupon_uses').upsert({
              code: coupon.code,
              user_email: verifiedEmail,
              order_id: razorpay_order_id,
            }, { onConflict: 'code,user_email' });
          }

          await supabase
            .from('discount_coupons')
            .update({ used_count: Number(coupon.used_count || 0) + 1 })
            .eq('code', coupon.code);
        }
      } catch (couponErr) {
        console.error('Coupon usage tracking error (non-fatal):', (couponErr as any)?.message || 'unknown');
      }
    }

    // === STEP 3: REFERRAL REWARD PROCESSING (runs regardless of LMS result) ===
    if (referralCode) {
      try {
        const codeToCheck = String(referralCode).trim().toUpperCase();
        const { data: referrerProfile, error: rpErr } = await supabase
          .from('referral_profiles')
          .select('*')
          .eq('referral_code', codeToCheck)
          .maybeSingle();

        if (rpErr) throw rpErr;

        if (!referrerProfile) {
          console.log(`[Referral] Code ${codeToCheck} not found in referral_profiles.`);
        } else if (referrerProfile.email.toLowerCase() === verifiedEmail.toLowerCase()) {
          console.log('[Referral] Buyer is using their own code. Skipping reward.');
        } else {
          const { data: orderRow, error: orderErr } = await supabase
            .from('website_orders')
            .select('total_amount, original_amount, discount_amount')
            .eq('order_id', razorpay_order_id)
            .single();

          if (orderErr) throw orderErr;
          if (!orderRow) {
            throw new Error(`Order not found for referral processing: ${razorpay_order_id}`);
          }

          const finalPrice = orderRow.total_amount || 0;
          const originalPrice = orderRow.original_amount || finalPrice;
          const buyerDiscount = orderRow.discount_amount || 0;
          const referrerReward = Math.floor(finalPrice * 0.05); // 5% of what was paid

          const newBalance = (referrerProfile.wallet_balance || 0) + referrerReward;
          const newLifetime = (referrerProfile.lifetime_referrals || 0) + 1;
          const newQuarterly = (referrerProfile.quarterly_referrals || 0) + 1;

          const { data: milestones, error: msErr } = await supabase
            .from('referral_milestones')
            .select('*')
            .order('referrals_required', { ascending: true });

          if (msErr) throw msErr;

          let milestoneBonus = 0;
          if (milestones) {
            for (const ms of milestones) {
              if (newQuarterly >= ms.referrals_required && (referrerProfile.quarterly_referrals || 0) < ms.referrals_required) {
                milestoneBonus += ms.bonus_coins;
                console.log(`[Referral] Milestone hit! Bonus: ${ms.bonus_coins}`);
              }
            }
          }


          const { error: updateErr } = await supabase
            .from('referral_profiles')
            .update({
              wallet_balance: newBalance + milestoneBonus,
              lifetime_referrals: newLifetime,
              quarterly_referrals: newQuarterly,
            })
            .eq('id', referrerProfile.id);

          if (updateErr) throw updateErr;

          const { error: txnErr } = await supabase.from('referral_transactions').insert({
            referrer_email: referrerProfile.email,
            buyer_email: verifiedEmail,
            referral_code: codeToCheck,
            order_id: razorpay_order_id,
            original_price: originalPrice,
            buyer_discount: buyerDiscount,
            final_price: finalPrice,
            referrer_reward: referrerReward + milestoneBonus,
            coins_used: actualCoinsApplied,
          });

          if (txnErr) throw txnErr;
          console.log(`[Referral] Successfully logged transaction.`);
        }
      } catch (referralErr) {
        console.error('Referral processing error (non-fatal):', (referralErr as any)?.message || 'unknown');
      }
    }

    // === STEP 4: DEDUCT BUYER COINS (runs regardless of LMS result) ===
    if (actualCoinsApplied && actualCoinsApplied > 0) {
      try {
        const { data: buyerRef } = await supabase
          .from('referral_profiles')
          .select('wallet_balance')
          .eq('email', verifiedEmail)
          .maybeSingle();

        if (buyerRef) {
          const newBal = Math.max((buyerRef.wallet_balance || 0) - actualCoinsApplied, 0);
          await supabase
            .from('referral_profiles')
            .update({ wallet_balance: newBal })
            .eq('email', verifiedEmail);
        }
      } catch (coinErr) {
        console.error('Coin deduction error (non-fatal):', (coinErr as any)?.message || 'unknown');
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('verify-payment error:', error?.message || 'unknown');
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
