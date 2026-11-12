import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { readBody, jsonRes } from '@/lib/site/http'

export const dynamic = 'force-dynamic'

/**
 * POST /api/site/validate-coupon  (port of the storefront api/validate-coupon.ts)
 * Auth: class genz session cookie (email comes from the session, never the body)
 * Body: { code, courseIds: string[], bundleId?: string, total: number }
 * Returns: { found: false } | { found: true, code, discount } | 400 { found: true, error }
 * create-order re-validates everything authoritatively; this is for display only.
 */
export async function POST(request: NextRequest) {
  const res = jsonRes(true);

  if (!isStorefrontConfigured()) return res.status(500).json({ error: 'Server configuration error' });

  const session = await getSession();
  if (!session?.email) return res.status(401).json({ error: 'Please log in to apply a code.' });
  const user = { email: session.email };
  const reqBody = await readBody(request);

  const email = user.email.toLowerCase();
  const code = String(reqBody?.code || '').trim().toUpperCase();
  const courseIds: string[] = Array.isArray(reqBody?.courseIds) ? reqBody.courseIds.map(String) : [];
  const bundleId: string | null = reqBody?.bundleId ? String(reqBody.bundleId) : null;
  const total = Number(reqBody?.total || 0);
  if (!code || code.length > 64) return res.status(400).json({ error: 'Enter a discount code.' });

  const supabase = storefrontDb();

  try {
    const { data: coupon } = await supabase.from('discount_coupons').select('*').eq('code', code).maybeSingle();
    if (!coupon) return res.status(200).json({ found: false });

    const now = new Date();
    const fail = (error: string) => res.status(400).json({ found: true, error });

    if (coupon.active === false) return fail('This discount code is inactive.');
    if (coupon.start_date && new Date(coupon.start_date) > now) return fail('This discount code is not active yet.');
    if (coupon.expires_at && new Date(coupon.expires_at) < now) return fail('This discount code has expired.');
    if (Number(coupon.max_uses || 0) > 0 && Number(coupon.used_count || 0) >= Number(coupon.max_uses)) {
      return fail('This discount code has reached its maximum uses.');
    }
    if (Number(coupon.min_order_value || 0) > 0 && total < Number(coupon.min_order_value)) {
      return fail(`Minimum order value for this code is ₹${coupon.min_order_value}.`);
    }

    const allowedEmails: string[] = Array.isArray(coupon.allowed_emails)
      ? coupon.allowed_emails.map((e: string) => e.toLowerCase())
      : [];
    if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
      return fail('This discount code is not available for your email.');
    }

    if (coupon.single_use_per_user !== false) {
      const { data: usage } = await supabase
        .from('coupon_uses').select('id').eq('code', coupon.code).eq('user_email', user.email).maybeSingle();
      if (usage) return fail('You have already used this discount code.');
    }

    if (coupon.first_purchase_only) {
      const { data: paidOrder } = await supabase
        .from('website_orders').select('order_id')
        .eq('user_email', user.email).eq('status', 'PAID').gt('total_amount', 0).limit(1).maybeSingle();
      if (paidOrder) return fail('This discount code is only for first purchases.');
    }

    if (coupon.applies_to !== 'ALL') {
      const targetId = String(coupon.applies_to || '').trim().toLowerCase();
      const hitsCourse = courseIds.some(id => id.trim().toLowerCase() === targetId);
      const hitsBundle = Boolean(bundleId && bundleId.trim().toLowerCase() === targetId);
      if (!hitsCourse && !hitsBundle) return fail(`This code doesn't apply to the selected courses.`);
    }

    let discount = coupon.discount_percentage
      ? Math.floor(total * (Number(coupon.discount_percentage) / 100))
      : Number(coupon.discount_amount || 0);
    const maxDiscount = Number(coupon.max_discount_amount || coupon.max_discount || 0);
    if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);

    return res.status(200).json({ found: true, code: coupon.code, discount: Math.min(discount, total) });
  } catch (err: any) {
    console.error('[validate-coupon] error:', err?.message || 'unknown');
    return res.status(500).json({ error: 'Could not check this code. Please try again.' });
  }
}
