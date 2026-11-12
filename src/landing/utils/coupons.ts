export async function validateCouponForCheckout({
  supabase,
  coupon,
  userEmail,
  total,
  courseIds,
  bundleId,
}: {
  supabase: any;
  coupon: any;
  userEmail: string;
  total: number;
  courseIds: string[];
  bundleId?: string | null;
}) {
  const now = new Date();
  const email = userEmail.toLowerCase();

  if (coupon.active === false) throw new Error('This discount code is inactive.');
  if (coupon.start_date && new Date(coupon.start_date) > now) throw new Error('This discount code is not active yet.');
  if (coupon.expires_at && new Date(coupon.expires_at) < now) throw new Error('This discount code has expired.');
  if (Number(coupon.max_uses || 0) > 0 && Number(coupon.used_count || 0) >= Number(coupon.max_uses)) {
    throw new Error('This discount code has reached its maximum uses.');
  }
  if (Number(coupon.min_order_value || 0) > 0 && total < Number(coupon.min_order_value)) {
    throw new Error(`Minimum order value for this code is ₹${coupon.min_order_value}.`);
  }

  const allowedEmails = Array.isArray(coupon.allowed_emails)
    ? coupon.allowed_emails.map((allowedEmail: string) => allowedEmail.toLowerCase())
    : [];
  if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
    throw new Error('This discount code is not available for your email.');
  }

  if (coupon.single_use_per_user !== false) {
    const { data: usage } = await supabase
      .from('coupon_uses')
      .select('id')
      .eq('code', coupon.code)
      .eq('user_email', userEmail)
      .maybeSingle();

    if (usage) throw new Error('You have already used this discount code.');
  }

  if (coupon.first_purchase_only) {
    const { data: paidOrder } = await supabase
      .from('website_orders')
      .select('order_id')
      .eq('user_email', userEmail)
      .eq('status', 'PAID')
      .gt('total_amount', 0)
      .limit(1)
      .maybeSingle();

    if (paidOrder) throw new Error('This discount code is only for first purchases.');
  }

  if (coupon.applies_to !== 'ALL') {
    const targetId = String(coupon.applies_to || '').trim().toLowerCase();
    const targetsSelectedCourse = courseIds.some(id => id.trim().toLowerCase() === targetId);
    const targetsCurrentBundle = Boolean(bundleId && bundleId.trim().toLowerCase() === targetId);

    if (!targetsSelectedCourse && !targetsCurrentBundle) {
      throw new Error(`This code doesn't apply to the selected courses.`);
    }
  }

  let calculatedDiscount = coupon.discount_percentage
    ? Math.floor(total * (Number(coupon.discount_percentage) / 100))
    : Number(coupon.discount_amount || 0);

  const maxDiscount = Number(coupon.max_discount_amount || coupon.max_discount || 0);
  if (maxDiscount > 0) {
    calculatedDiscount = Math.min(calculatedDiscount, maxDiscount);
  }

  return Math.min(calculatedDiscount, total);
}
