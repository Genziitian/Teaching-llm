// Coupon checks run on the server (/api/site/validate-coupon): coupon_uses and website_orders are
// only readable there, and the user is the class session (email from the session, never the client).
// create-order re-validates everything authoritatively when the order is placed.

/**
 * Validate a coupon for the signed-in user's checkout and return the discount.
 * Throws with a user-facing message when the coupon is not usable.
 * `supabase` and `userEmail` are accepted for compatibility with the storefront signature and ignored.
 */
export async function validateCouponForCheckout({
  coupon,
  total,
  courseIds,
  bundleId,
}: {
  supabase?: any;
  coupon: any;
  userEmail?: string;
  total: number;
  courseIds: string[];
  bundleId?: string | null;
}): Promise<number> {
  const code = String(coupon?.code || coupon || '').trim().toUpperCase();
  if (!code) throw new Error('Enter a discount code.');

  let res: Response;
  try {
    res = await fetch('/api/site/validate-coupon', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ code, total, courseIds, bundleId: bundleId || undefined }),
    });
  } catch {
    throw new Error('Could not check this code. Please try again.');
  }

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.error || 'Could not check this code. Please try again.');
  if (!data?.found) throw new Error('Invalid discount code.');
  return Number(data.discount || 0);
}
