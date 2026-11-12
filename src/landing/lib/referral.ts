import { supabase } from '@/landing/lib/supabase';

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

/** Generate a deterministic 5-character personalized referral code */
export function generateReferralCode(email: string, name?: string): string {
  // Extract up to 2 initials from the name (letters only)
  let initials = '';
  if (name) {
    const parts = name.trim().split(/\s+/);
    initials += (parts[0]?.[0] || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    if (parts.length > 1) {
      initials += (parts[parts.length - 1]?.[0] || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    }
  }
  
  // If no initials extracted, fallback to first letter of email
  if (!initials && email) {
    initials = email[0]?.replace(/[^A-Za-z]/g, '').toUpperCase() || 'X';
  }

  // Ensure initials is max 2 chars
  initials = initials.substring(0, 2);

  // Generate a random string to fill the rest (up to 5 total characters)
  const requiredRandomChars = 5 - initials.length;
  // Use a mix of uppercase letters and numbers
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  for (let i = 0; i < requiredRandomChars; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${initials}${randomPart}`;
}

/** Fetch (or create) referral profile for the current user */
export async function getReferralProfile(userId: string, email: string, name?: string): Promise<ReferralProfile | null> {
  try {
    // Try to get existing profile
    const { data, error } = await supabase
      .from('referral_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      // Check quarterly reset (lazy reset)
      const quarterStart = new Date(data.quarter_start_date);
      const now = new Date();
      const diffMs = now.getTime() - quarterStart.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      if (diffDays >= 90) {
        // Reset quarterly counter
        const { data: updated } = await supabase
          .from('referral_profiles')
          .update({
            quarterly_referrals: 0,
            quarter_start_date: now.toISOString(),
          })
          .eq('id', userId)
          .select()
          .single();
        return updated;
      }
      
      return data;
    }

    if (error && error.code !== 'PGRST116') {
      console.error('Referral profile fetch error:', error);
      return null;
    }

    // Create new profile
    const code = generateReferralCode(email, name);
    
    // Ensure code uniqueness — if collision, append random chars
    const { data: existing } = await supabase
      .from('referral_profiles')
      .select('referral_code')
      .eq('referral_code', code)
      .maybeSingle();

    const finalCode = existing
      ? `${code}${Math.random().toString(36).slice(2, 4).toUpperCase()}`
      : code;

    const { data: newProfile, error: insertError } = await supabase
      .from('referral_profiles')
      .insert({
        id: userId,
        email: email,
        referral_code: finalCode,
        wallet_balance: 0,
        lifetime_referrals: 0,
        quarterly_referrals: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create referral profile:', insertError);
      return null;
    }

    return newProfile;
  } catch (err) {
    console.error('getReferralProfile error:', err);
    return null;
  }
}

/** Validate a referral code exists and return the referrer email */
export async function validateReferralCode(code: string): Promise<{ valid: boolean; referrerEmail?: string }> {
  try {
    const { data, error } = await supabase
      .from('referral_profiles')
      .select('email')
      .eq('referral_code', code.trim().toUpperCase())
      .maybeSingle();

    if (error || !data) return { valid: false };
    return { valid: true, referrerEmail: data.email };
  } catch {
    return { valid: false };
  }
}

/** Get referral transactions for a user (as referrer) */
export async function getReferralHistory(email: string): Promise<ReferralTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('referral_transactions')
      .select('*')
      .eq('referrer_email', email)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('getReferralHistory error:', err);
    return [];
  }
}

/** Get milestone configuration */
export async function getMilestones(): Promise<{ referrals_required: number; bonus_coins: number }[]> {
  try {
    const { data } = await supabase
      .from('referral_milestones')
      .select('*')
      .order('referrals_required', { ascending: true });
    return data || [];
  } catch {
    return [
      { referrals_required: 5, bonus_coins: 50 },
      { referrals_required: 10, bonus_coins: 110 },
      { referrals_required: 20, bonus_coins: 250 },
    ];
  }
}
