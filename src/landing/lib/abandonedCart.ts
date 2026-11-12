import { apiService } from '@/landing/lib/api';
import { supabase } from '@/landing/lib/supabase';

/** How long an unpaid (CREATED) order keeps triggering the reminder. */
export const CART_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
/** "Remind me later" pauses the reminder for this long. */
export const CART_SNOOZE_MS = 12 * 60 * 60 * 1000;

const HINT_KEY = 'genz_last_checkout';
const SNOOZE_KEY = 'genz_cart_snooze';
const SHOWN_KEY = 'genz_cart_shown_session';

export interface AbandonedCart {
  orderId: string;
  checkoutId: string | null;
  courseName: string;
  createdAt: string;
}

const read = (store: Storage, key: string) => {
  try { return store.getItem(key); } catch { return null; }
};
const write = (store: Storage, key: string, value: string) => {
  try { store.setItem(key, value); } catch { /* storage unavailable */ }
};

/** Called when a Razorpay order is created, so the reminder can send the user back to the right checkout page. */
export function rememberCheckout(orderId: string, checkoutId: string, courseName: string) {
  write(localStorage, HINT_KEY, JSON.stringify({ orderId, checkoutId, courseName }));
}

export function wasShownThisSession() {
  return read(sessionStorage, SHOWN_KEY) === '1';
}
export function markShownThisSession() {
  write(sessionStorage, SHOWN_KEY, '1');
}

export function snoozeCart(orderId: string) {
  write(localStorage, SNOOZE_KEY, JSON.stringify({ orderId, until: Date.now() + CART_SNOOZE_MS }));
}
function isSnoozed(orderId: string) {
  try {
    const v = JSON.parse(read(localStorage, SNOOZE_KEY) || 'null');
    return !!v && v.orderId === orderId && Number(v.until) > Date.now();
  } catch {
    return false;
  }
}

/**
 * Returns the user's most recent unpaid order if it is worth reminding about, otherwise null.
 * Rules: latest CREATED order only, younger than 2 days, no PAID order since (or for the same course),
 * course still active, and not snoozed.
 */
export async function findAbandonedCart(email: string): Promise<AbandonedCart | null> {
  const orders: any[] = await apiService.getOrders(email);
  if (!Array.isArray(orders) || orders.length === 0) return null;

  const byNewest = [...orders].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const latest = byNewest.find((o) => String(o.status).toUpperCase() === 'CREATED');
  if (!latest) return null;

  const createdMs = +new Date(latest.created_at);
  if (!createdMs || Date.now() - createdMs > CART_WINDOW_MS) return null;
  if (isSnoozed(latest.order_id)) return null;

  const courseIds: string[] = Array.isArray(latest.course_ids) ? latest.course_ids : [];
  const paidSince = orders.some((o) => {
    if (String(o.status).toUpperCase() !== 'PAID') return false;
    const paidCourseIds: string[] = Array.isArray(o.course_ids) ? o.course_ids : [];
    const sameCourse = courseIds.some((id) => paidCourseIds.includes(id));
    return sameCourse || +new Date(o.created_at) >= createdMs;
  });
  if (paidSince) return null;

  let hint: { orderId?: string; checkoutId?: string; courseName?: string } = {};
  try { hint = JSON.parse(read(localStorage, HINT_KEY) || '{}'); } catch { /* ignore */ }
  const hasHint = hint.orderId === latest.order_id && !!hint.checkoutId;
  const checkoutId = hasHint ? (hint.checkoutId as string) : courseIds.length === 1 ? courseIds[0] : null;

  const lookupId = checkoutId || courseIds[0];
  if (!lookupId) return null;
  const { data: course } = await supabase.from('courses').select('name, active').eq('id', lookupId).maybeSingle();
  if (!course || course.active === false) return null;

  return {
    orderId: latest.order_id,
    checkoutId,
    courseName: (hasHint && hint.courseName) || course.name,
    createdAt: latest.created_at,
  };
}
