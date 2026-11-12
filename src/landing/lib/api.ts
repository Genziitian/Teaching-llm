// Storefront API client, ported to class genz.
// Every endpoint is a same-origin /api/site/* route; auth is the class session cookie.
// Non-GET requests carry X-Requested-With (required by the class middleware).

const JSON_POST_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
};

const readJsonResponse = async (res: Response) => {
  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();

  if (contentType.includes('application/json')) {
    return rawText ? JSON.parse(rawText) : {};
  }

  throw new Error(`API returned ${contentType || 'non-JSON'} instead of JSON`);
};

const postJson = (url: string, payload: unknown) =>
  fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });

export const apiService = {
  // 1. Manager Dashboard Data (storefront admin dashboard is not part of the ported public site)
  managerFetch: async (_tab: string, _filter: string = 'all', _search: string = '', _from: string = '', _to: string = ''): Promise<any> => {
    throw new Error('The storefront manager dashboard is not available here. Use the class dashboard.');
  },

  // 2. Most recent order of the signed-in user (was a direct Supabase read in production mode)
  getLastOrder: async (email: string) => {
    const orders = await apiService.getOrders(email);
    return Array.isArray(orders) && orders.length > 0 ? orders[0] : null;
  },

  // 3. Get User Orders (server only ever returns the session user's orders, newest first)
  getOrders: async (email: string) => {
    const res = await fetch(`/api/site/get-orders?email=${encodeURIComponent(email)}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const errorData = await readJsonResponse(res);
      throw new Error(errorData.error || 'Failed to fetch orders');
    }
    return readJsonResponse(res);
  },

  // 4. Create Razorpay Order
  createOrder: async (payload: { amount: number, email: string, courseIds: string[], discountCode?: string, bundleId?: string, referralCode?: string, coinsToApply?: number, selectedClassType?: string, selectedPricingTierIndex?: number, selectedPricingTierName?: string, selectedPricingTierPrice?: number }) => {
    const res = await postJson('/api/site/create-order', payload);
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Order creation failed');
    return data;
  },

  // 4b. Server-side coupon check
  // Resolves { found:false } when the code isn't a coupon; throws with a user-facing message when it is but isn't usable.
  validateCoupon: async (payload: { code: string, courseIds: string[], bundleId?: string | null, total: number }): Promise<{ found: boolean, code?: string, discount?: number }> => {
    const res = await postJson('/api/site/validate-coupon', payload);
    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || 'Could not check this code.');
    return data;
  },

  // 5. Verify Payment
  verifyPayment: async (payload: any) => {
    const res = await postJson('/api/site/verify-payment', payload);
    if (!res.ok) {
      const errorData = await readJsonResponse(res);
      throw new Error(errorData.error || 'Payment verification failed');
    }
    return readJsonResponse(res);
  },

  // 6. Log Payment Failure (the storefront endpoint never existed in api/, so this stayed a silent no-op there; kept as a no-op)
  logPaymentFailure: async (_payload: { email: string, order_id: string, failure_source: string, courseIds: string[] }) => {
    return;
  },

  // 7. Public forms (used by the lead magnet, 1:1 booking and careers forms)
  leadMagnet: (payload: any) => postJson('/api/site/lead-magnet', payload),
  book1on1Slot: (payload: any) => postJson('/api/site/book-1on1-slot', payload),
  submitJobApplication: (payload: any) => postJson('/api/site/job-applications', payload),
};
