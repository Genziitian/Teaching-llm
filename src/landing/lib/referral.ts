import { generateReferralCode } from '@/lib/site/referral-code';

export { generateReferralCode };

const REF_STORAGE_KEY = 'ref_code';
const REF_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ========== LOCAL STORAGE / COOKIE HELPERS ==========

/** Save a referral code to localStorage with a 24-hour expiry */
export function saveReferralCookie(code: string) {
  const data = {
    code: code.trim().toUpperCase(),
    expires: Date.now() + REF_EXPIRY_MS,
  };
  localStorage.setItem(REF_STORAGE_KEY, JSON.stringify(data));
}

/** Get the stored referral code if it hasn't expired */
export function getStoredReferralCode(): string | null {
  try {
    const raw = localStorage.getItem(REF_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.expires && Date.now() > data.expires) {
      localStorage.removeItem(REF_STORAGE_KEY);
      return null;
    }
    return data.code || null;
  } catch {
    return null;
  }
}

/** Clear the stored referral code */
export function clearReferralCookie() {
  localStorage.removeItem(REF_STORAGE_KEY);
}

// ========== API HELPERS ==========
// All reads go through session-scoped class genz routes (/api/site/me/*): the user is the
// signed-in class session, never an id or email passed from the browser.

export interface ReferralProfile {
  id: string;
  email: string;
  referral_code: string;
  wallet_balance: number;
  lifetime_referrals: number;
  quarterly_referrals: number;
  quarter_start_date: string;
  created_at: string;
}

export interface ReferralTransaction {
  id: string;
  referrer_email: string;
  buyer_email: string;
  referral_code: string;
  order_id: string;
  original_price: number;
  buyer_discount: number;
  final_price: number;
  referrer_reward: number;
  coins_used: number;
  created_at: string;
}

export interface ReferralMilestone {
  referrals_required: number;
  bonus_coins: number;
}

export interface MyReferralData {
  profile: ReferralProfile | null;
  history: ReferralTransaction[];
  milestones: ReferralMilestone[];
  /** Set when no profile could be created (e.g. 'NO_STOREFRONT_ACCOUNT'). */
  reason?: string;
}

const DEFAULT_MILESTONES: ReferralMilestone[] = [
  { referrals_required: 5, bonus_coins: 50 },
  { referrals_required: 10, bonus_coins: 110 },
  { referrals_required: 20, bonus_coins: 250 },
];

// Calls made together (profile + history + milestones) share one request.
const SHARE_WINDOW_MS = 2000;
let inflight: { at: number; promise: Promise<MyReferralData | null> } | null = null;

/** Profile (get-or-create), history and milestones of the signed-in user, in one request. */
export async function getMyReferralData(options: { fresh?: boolean } = {}): Promise<MyReferralData | null> {
  if (!options.fresh && inflight && Date.now() - inflight.at < SHARE_WINDOW_MS) return inflight.promise;
  const promise = (async () => {
    try {
      const res = await fetch('/api/site/me/referral', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        profile: data?.profile || null,
        history: Array.isArray(data?.history) ? data.history : [],
        milestones: Array.isArray(data?.milestones) ? data.milestones : DEFAULT_MILESTONES,
        reason: data?.reason,
      } as MyReferralData;
    } catch (err) {
      console.error('getMyReferralData error:', err);
      return null;
    }
  })();
  inflight = { at: Date.now(), promise };
  return promise;
}

/** Fetch (or create) the referral profile of the signed-in user. Arguments are kept for compatibility and ignored. */
export async function getReferralProfile(_userId?: string, _email?: string, _name?: string): Promise<ReferralProfile | null> {
  const data = await getMyReferralData();
  return data?.profile || null;
}

/** Validate a referral code exists; `own` is true when it is the signed-in user's own code. */
export async function validateReferralCode(code: string): Promise<{ valid: boolean; own?: boolean }> {
  try {
    const res = await fetch(`/api/site/referral/validate?code=${encodeURIComponent(code.trim().toUpperCase())}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) return { valid: false };
    const data = await res.json();
    return { valid: Boolean(data?.valid), own: Boolean(data?.own) };
  } catch {
    return { valid: false };
  }
}

/** Referral transactions of the signed-in user (as referrer). Argument kept for compatibility and ignored. */
export async function getReferralHistory(_email?: string): Promise<ReferralTransaction[]> {
  const data = await getMyReferralData();
  return data?.history || [];
}

/** Get milestone configuration */
export async function getMilestones(): Promise<ReferralMilestone[]> {
  const data = await getMyReferralData();
  return data?.milestones?.length ? data.milestones : DEFAULT_MILESTONES;
}
