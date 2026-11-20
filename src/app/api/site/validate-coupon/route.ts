import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { isStorefrontConfigured } from '@/lib/storefront/db'
import { siteDb } from '@/lib/site/store-courses'
import { readBody, jsonRes } from '@/lib/site/http'
import { checkSiteCoupon } from '@/lib/site/coupon'

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
  const reqBody = await readBody(request);

  const email = session.email.toLowerCase();
  const code = String(reqBody?.code || '').trim().toUpperCase();
  const courseIds: string[] = Array.isArray(reqBody?.courseIds) ? reqBody.courseIds.map(String) : [];
  const bundleId: string | null = reqBody?.bundleId ? String(reqBody.bundleId) : null;
  const total = Number(reqBody?.total || 0);
  if (!code || code.length > 64) return res.status(400).json({ error: 'Enter a discount code.' });

  try {
    // One coupon list for app + website: class "Coupon" rules (src/lib/coupon-rules.ts).
    const result = await checkSiteCoupon({
      supabase: siteDb(), code, userId: session.userId, email, courseIds, bundleId, subtotal: total,
    });
    if (!result.ok) {
      if (result.status === 404) return res.status(200).json({ found: false });
      return res.status(400).json({ found: true, error: result.error });
    }
    return res.status(200).json({ found: true, code: result.coupon.code, discount: result.discountAmount });
  } catch (err: any) {
    console.error('[validate-coupon] error:', err?.message || 'unknown');
    return res.status(500).json({ error: 'Could not check this code. Please try again.' });
  }
}
