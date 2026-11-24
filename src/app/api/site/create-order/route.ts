import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { storefrontDb } from '@/lib/storefront/db'
import { siteDb } from '@/lib/site/store-courses'
import { getStorefrontRazorpay } from '@/lib/site/razorpay'
import { readBody, jsonRes } from '@/lib/site/http'
import { checkSiteCoupon } from '@/lib/site/coupon'

export const dynamic = 'force-dynamic'

const resolveSelectedPricingTier = ({
  pricingOptions,
  selectedPricingTierIndex,
  selectedPricingTierName,
  selectedPricingTierPrice,
  selectedClassType,
  requestedAmount,
  coinsToApply,
}: {
  pricingOptions: any[];
  selectedPricingTierIndex?: number | string;
  selectedPricingTierName?: string;
  selectedPricingTierPrice?: number | string;
  selectedClassType?: string;
  requestedAmount?: number | string;
  coinsToApply?: number | string;
}) => {
  if (!Array.isArray(pricingOptions) || pricingOptions.length === 0) return null;

  const tierIndex = Number(selectedPricingTierIndex);
  if (Number.isInteger(tierIndex) && tierIndex >= 0 && tierIndex < pricingOptions.length) {
    return pricingOptions[tierIndex];
  }

  const tierName = typeof selectedPricingTierName === 'string' ? selectedPricingTierName.trim().toLowerCase() : '';
  if (tierName) {
    const byName = pricingOptions.find((tier: any) => String(tier.name || '').trim().toLowerCase() === tierName);
    if (byName) return byName;
  }

  const tierPrice = Number(selectedPricingTierPrice);
  if (Number.isFinite(tierPrice) && tierPrice > 0) {
    const priceMatches = pricingOptions.filter((tier: any) => Number(tier.price) === tierPrice);
    const typeMatches = selectedClassType
      ? priceMatches.filter((tier: any) => String(tier.type || '').toLowerCase() === String(selectedClassType).toLowerCase())
      : priceMatches;
    if (typeMatches.length === 1) return typeMatches[0];
    if (priceMatches.length === 1) return priceMatches[0];
  }

  const requestedTierPrice = Number(requestedAmount) + Number(coinsToApply || 0);
  if (Number.isFinite(requestedTierPrice) && requestedTierPrice > 0) {
    const amountMatches = pricingOptions.filter((tier: any) => Number(tier.price) === requestedTierPrice);
    const typeMatches = selectedClassType
      ? amountMatches.filter((tier: any) => String(tier.type || '').toLowerCase() === String(selectedClassType).toLowerCase())
      : amountMatches;
    if (typeMatches.length === 1) return typeMatches[0];
    if (amountMatches.length === 1) return amountMatches[0];
  }

  if (selectedClassType) {
    const classTypeMatches = pricingOptions.filter((tier: any) => (
      String(tier.type || '').toLowerCase() === String(selectedClassType).toLowerCase()
    ));
    if (classTypeMatches.length === 1) return classTypeMatches[0];
  }

  return null;
};

const normalizeClassType = (value: unknown) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

// The class type used for enrollment is always derived server-side (pricing tier / course row).
// A client-supplied type is only cross-checked: if it disagrees with the server value the order is rejected.
const classTypeMismatch = (clientType: unknown, serverType: unknown) => {
  const client = normalizeClassType(clientType);
  const server = normalizeClassType(serverType);
  return Boolean(client && server && client !== server);
};

const insertWebsiteOrder = async (supabase: any, orderPayload: Record<string, any>) => {
  const { error } = await supabase.from('website_orders').insert(orderPayload);
  if (!error) return null;

  if (error.code === 'PGRST204' && error.message?.includes('selected_class_type')) {
    const { selected_class_type, ...fallbackPayload } = orderPayload;
    console.warn('[website_orders] selected_class_type column is missing; inserting order without it.');
    const { error: fallbackError } = await supabase.from('website_orders').insert(fallbackPayload);
    return fallbackError || null;
  }

  return error;
};

export async function POST(request: NextRequest) {
  const res = jsonRes();

  try {
    const supabase = siteDb();
    const razorpay = getStorefrontRazorpay();
    const {
      amount,
      email,
      courseIds,
      bundleId,
      discountCode,
      referralCode,
      coinsToApply,
      selectedClassType,
      selectedPricingTierIndex,
      selectedPricingTierName,
      selectedPricingTierPrice,
    } = await readBody(request);

    if (!email || !Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ error: 'Email and at least one course ID are required' });
    }

    // Checkout is for signed-in class genz users (the class session cookie replaces the Supabase bearer token).
    const session = await getSession();
    if (!session?.email) {
      return res.status(401).json({ error: 'Please log in to continue.' });
    }

    // Coupons are tied to a student's email, so when one is used the caller must prove they own that email.
    if (discountCode) {
      if (session.email.toLowerCase() !== String(email).toLowerCase()) {
        return res.status(401).json({ error: 'Please log in with the same email to use a discount code.' });
      }
    }

    let totalAmount = 0;
    let totalOriginalPrice = 0;
    let discountApplied = false;
    let referrerEmail: string | null = null;
    let referralDiscount = 0;
    // Never taken from the client: set below from the pricing tier / course data.
    let orderClassType: string | null = null;

    if (bundleId) {
      const { data: bundle, error: bundleError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', bundleId)
        .eq('isBundle', true)
        .single();

      if (bundleError || !bundle) {
        return res.status(400).json({ error: 'Invalid bundle ID' });
      }

      const bundleSubCourses = Array.isArray(bundle.bundleCourses) ? bundle.bundleCourses : [];
      if (bundleSubCourses.length === 0) {
        return res.status(400).json({ error: 'Bundle has no courses' });
      }

      const validBundleCourseIds = bundleSubCourses.flatMap((bc: any) => [bc.courseId, bc.courseId2, bc.courseId3].filter(Boolean));
      
      // Fixed bundle enforcement
      if (bundle.isFixedBundle) {
        const allBundleCoursesSelected = validBundleCourseIds.every((id: string) => courseIds.includes(id));
        if (!allBundleCoursesSelected || courseIds.length !== validBundleCourseIds.length) {
            return res.status(400).json({ error: 'This is a fixed bundle. You must purchase all courses.' });
        }
      }

      const invalidSelections = courseIds.filter((courseId: string) => !validBundleCourseIds.includes(courseId));
      if (invalidSelections.length > 0) {
        return res.status(400).json({ error: 'Some course IDs do not belong to this bundle' });
      }

      // 1. Calculate Raw Subtotal
      // Fixed bundles with pricing tiers must be priced from the selected tier.
      // Their child course prices may intentionally be 0.
      if (bundle.isFixedBundle && Array.isArray(bundle.pricing_options) && bundle.pricing_options.length > 0) {
        const selectedTier = resolveSelectedPricingTier({
          pricingOptions: bundle.pricing_options,
          selectedPricingTierIndex,
          selectedPricingTierName,
          selectedPricingTierPrice,
          selectedClassType,
          requestedAmount: amount,
          coinsToApply,
        });
        if (selectedTier) {
          totalOriginalPrice = Number(selectedTier.price);
          if (!Number.isFinite(totalOriginalPrice) || totalOriginalPrice <= 0) {
            return res.status(400).json({ error: 'Invalid pricing tier price' });
          }
          orderClassType = selectedTier.type || bundle.class_type || null;
        } else {
          return res.status(400).json({ error: 'Invalid pricing tier selected' });
        }
      } else {
        // Fallback: sum individual course prices (for non-fixed bundles).
        // A row is priced when ANY of its course IDs is selected (courseId2/courseId3 are valid selections too).
        totalOriginalPrice = bundleSubCourses
          .filter((bc: any) => [bc.courseId, bc.courseId2, bc.courseId3].filter(Boolean).some((cid: string) => courseIds.includes(cid)))
          .reduce((sum: number, bc: any) => sum + Number(bc.price || 0), 0);
        orderClassType = bundle.class_type || null;
      }

      if (classTypeMismatch(selectedClassType, orderClassType)) {
        return res.status(400).json({ error: 'Selected class type does not match the selected plan.' });
      }

      totalAmount = totalOriginalPrice;

      // 2. Process Discount Code strictly if provided
      let couponSavings = 0;
      let refSavings = 0;

      if (discountCode) {
        const codeToApply = String(discountCode).trim().toUpperCase();
        const isAllSelected = validBundleCourseIds.every((id: string) => courseIds.includes(id));
        const selectedBundleRowsCount = bundleSubCourses.filter((bc: any) =>
          [bc.courseId, bc.courseId2, bc.courseId3].filter(Boolean).some((cid: string) => courseIds.includes(cid))
        ).length;
        
        // Handle bundle-specific discount code
        if (bundle.bundleDiscountCode && codeToApply === String(bundle.bundleDiscountCode).trim().toUpperCase()) {
            const firstBundleCourse = bundleSubCourses[0] || {};
            // Either source saying "any" wins — top-level DB default "all" used to mask nested saves
            const bundleDiscountMode = (bundle.bundleDiscountMode === 'any' || firstBundleCourse._bundleDiscountMode === 'any') ? 'any' : 'all';
            const rawMin = Number(
              firstBundleCourse._bundleDiscountMode === 'any' && firstBundleCourse._bundleDiscountMinCourses != null
                ? firstBundleCourse._bundleDiscountMinCourses
                : (bundle.bundleDiscountMinCourses ?? firstBundleCourse._bundleDiscountMinCourses ?? 3)
            );
            const normalizedMin = [1, 2, 3, 5].includes(rawMin) ? rawMin : 3;
            const requiredCount = bundleDiscountMode === 'any'
              ? Math.max(1, Math.min(normalizedMin, bundleSubCourses.length))
              : bundleSubCourses.length;
            const isEligibleForBundleCode = bundleDiscountMode === 'any'
              ? selectedBundleRowsCount >= requiredCount
              : isAllSelected;

            if (isEligibleForBundleCode) {
               const bundleDiscountVal = Number(bundle.bundleDiscountAmount || bundle.bundleDiscountPrice || firstBundleCourse._bundleDiscountAmount || 0);
               couponSavings = Math.min(bundleDiscountVal, totalOriginalPrice);
            } else {
               return res.status(400).json({
                 error: bundleDiscountMode === 'any'
                   ? `This code requires at least ${requiredCount} selected courses.`
                   : 'This code requires all courses in the bundle to be selected.'
               });
            }
        } else {
            // Global coupons: the one class coupon list (same rules as the app checkout)
            const result = await checkSiteCoupon({
              supabase, code: codeToApply, userId: session.userId, email, courseIds, bundleId, subtotal: totalAmount,
            });
            if (!result.ok) return res.status(400).json({ error: result.status === 404 ? 'Invalid discount code' : result.error });
            couponSavings = result.discountAmount;
        }
      }

      if (referralCode && !discountCode) {
        const rProfile = await supabase.from('referral_profiles').select('email').eq('referral_code', referralCode.toUpperCase()).maybeSingle();
        if (rProfile.data && rProfile.data.email.toLowerCase() !== email.toLowerCase()) {
            refSavings = Math.floor(totalAmount * 0.05);
            referrerEmail = rProfile.data.email;
        }
      }

      // 3. APPLY DISCOUNTS (SINGLE DISCOUNT ENFORCEMENT)
      // Mirroring frontend: Priority is given to the discountCode if provided.
      let finalDiscount = 0;
      if (discountCode) {
        finalDiscount = couponSavings;
      } else {
        finalDiscount = refSavings;
      }

      totalAmount = Math.max(totalOriginalPrice - finalDiscount, 0);
      discountApplied = finalDiscount > 0;
      referralDiscount = refSavings;

    } else {
      // Logic for single course purchases remains mostly same
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, price, discountPrice, term, exam_stages, tags, class_type')
        .in('id', courseIds);

      // An empty result is allowed here: a cart holding only a bundle sends just its child IDs,
      // which are matched to the bundle below (unmatched IDs are still rejected).
      if (coursesError || !courses) {
        return res.status(400).json({ error: 'Invalid course IDs' });
      }

      // Single-course checkout: the class type is the course's own. Multi-course carts store none and
      // verify-payment falls back to each course's class_type.
      orderClassType = courses.length === 1 ? (courses[0].class_type || null) : null;
      if (classTypeMismatch(selectedClassType, orderClassType)) {
        return res.status(400).json({ error: 'Selected class type does not match this course.' });
      }

      // Every selected ID must be priced: either a storefront course, or a child of a bundle (the cart
      // sends a bundle as its child course IDs). Children are priced once per bundle at the bundle's
      // price; any other ID is rejected so it cannot be enrolled for free.
      const knownIds = new Set(courses.map((c: any) => String(c.id)))
      const unknownIds = courseIds.filter((cid: string) => !knownIds.has(String(cid)))
      const pricedRows: any[] = [...courses]
      if (unknownIds.length > 0) {
        const { data: bundles } = await supabase.from('courses').select('*').eq('isBundle', true)
        const remaining = new Set(unknownIds.map(String))
        for (const b of bundles || []) {
          const childIds: string[] = (Array.isArray(b.bundleCourses) ? b.bundleCourses : [])
            .flatMap((bc: any) => [bc.courseId, bc.courseId2, bc.courseId3].filter(Boolean).map(String))
          if (childIds.length > 0 && childIds.some((cid) => remaining.has(cid))) {
            pricedRows.push(b)
            childIds.forEach((cid) => remaining.delete(cid))
          }
          if (remaining.size === 0) break
        }
        if (remaining.size > 0) {
          return res.status(400).json({ error: 'Invalid course IDs' });
        }
      }

      totalOriginalPrice = pricedRows.reduce((sum: number, course: any) => sum + Number(course.price || 0), 0);
      totalAmount = pricedRows.reduce((sum: number, course: any) => {
        const effectivePrice = course.discountPrice && Number(course.discountPrice) > 0 ? Number(course.discountPrice) : Number(course.price || 0);
        return sum + effectivePrice;
      }, 0);

      // Handle Coupons/Referrals for standalone courses (SINGLE DISCOUNT ENFORCEMENT)
      if (discountCode) {
        const codeToApply = String(discountCode).trim().toUpperCase();
        const result = await checkSiteCoupon({
          supabase, code: codeToApply, userId: session.userId, email, courseIds, bundleId: null, subtotal: totalAmount,
        });
        if (!result.ok) return res.status(400).json({ error: result.status === 404 ? 'Invalid discount code' : result.error });
        totalAmount = Math.max(totalAmount - result.discountAmount, 0);
        discountApplied = true;
      } else if (referralCode) {
          const refResult = await supabase.from('referral_profiles').select('email').eq('referral_code', referralCode.toUpperCase()).maybeSingle();
          if (refResult.data && refResult.data.email.toLowerCase() !== email.toLowerCase()) {
              const rD = Math.floor(totalAmount * 0.05);
              totalAmount = Math.max(totalAmount - rD, 0);
              referrerEmail = refResult.data.email;
              referralDiscount = rD;
              discountApplied = true;
          }
      }
    }

    // --- COIN WALLET DEDUCTION ---
    let coinsApplied = 0;
    const MAX_COINS_PER_ORDER = 50;
    if (coinsToApply && coinsToApply > 0) {
      const { data: buyerReferral } = await supabase
        .from('referral_profiles')
        .select('wallet_balance')
        .eq('email', email)
        .maybeSingle();

      if (buyerReferral) {
        // Server-side enforcement: cap at 50 coins, actual balance, and keep cart ≥ ₹1
        const maxCoins = Math.min(MAX_COINS_PER_ORDER, buyerReferral.wallet_balance || 0, totalAmount - 1);
        coinsApplied = Math.min(coinsToApply, Math.max(maxCoins, 0));
        if (coinsApplied > 0) {
          totalAmount = totalAmount - coinsApplied;
        }
      }
    }

    if (totalAmount <= 0) totalAmount = 1;
    if (totalAmount < 1) {
      return res.status(400).json({ error: 'Total amount must be at least ₹1' });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    });

    const insertError = await insertWebsiteOrder(supabase, {
      order_id: order.id,
      user_email: email,
      course_ids: courseIds,
      total_amount: totalAmount,
      original_amount: totalOriginalPrice,
      discount_amount: totalOriginalPrice - totalAmount,
      status: 'CREATED',
      discount_code: discountCode || null,
      referral_code: referralCode || null,
      coins_applied: coinsApplied || 0,
      selected_class_type: orderClassType,
    });

    if (insertError) {
      throw insertError;
    }

    return res.status(200).json({
      ...order,
      _serverTotal: totalAmount,
      _discountApplied: discountApplied,
      _referralDiscount: referralDiscount,
      _coinsApplied: coinsApplied,
      _referrerEmail: referrerEmail,
    });
  } catch (error: any) {
    console.error('create-order error:', error?.message || 'unknown');
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
