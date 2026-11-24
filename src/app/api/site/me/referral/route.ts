import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { escapeLike } from '@/lib/site/http'
import { findStorefrontUserIdByEmail, NO_STOREFRONT_ACCOUNT, NO_STORE_HEADERS } from '@/lib/site/me'
import { generateReferralCode, referralCodeCollisionSuffix } from '@/lib/site/referral-code'

export const dynamic = 'force-dynamic'

const QUARTER_DAYS = 90
const MAX_CODE_ATTEMPTS = 6
const DEFAULT_MILESTONES = [
  { referrals_required: 5, bonus_coins: 50 },
  { referrals_required: 10, bonus_coins: 110 },
  { referrals_required: 20, bonus_coins: 250 },
]

type Db = ReturnType<typeof storefrontDb>

async function findProfile(db: Db, email: string) {
  const { data, error } = await db
    .from('referral_profiles')
    .select('*')
    .ilike('email', escapeLike(email))
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as any | null
}

/** Lazy quarterly reset (same rule as the storefront: 90 days after quarter_start_date). */
async function applyQuarterlyReset(db: Db, profile: any) {
  const quarterStart = new Date(profile.quarter_start_date)
  const now = new Date()
  const diffDays = (now.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24)
  if (Number.isFinite(diffDays) && diffDays < QUARTER_DAYS) return profile

  const { data: updated, error } = await db
    .from('referral_profiles')
    .update({ quarterly_referrals: 0, quarter_start_date: now.toISOString() })
    .eq('id', profile.id)
    .select()
    .single()
  if (error) throw error
  return updated
}

async function codeTaken(db: Db, code: string): Promise<boolean> {
  const { data, error } = await db
    .from('referral_profiles')
    .select('referral_code')
    .eq('referral_code', code)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

/** Create the referral profile with a unique code. Returns null when the email has no storefront account. */
async function createProfile(db: Db, email: string, name: string) {
  const userId = await findStorefrontUserIdByEmail(email)
  if (!userId) return null

  const base = generateReferralCode(email, name)
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? base : `${attempt === 1 ? base : generateReferralCode(email, name)}${referralCodeCollisionSuffix()}`
    if (await codeTaken(db, candidate)) continue

    const { data, error } = await db
      .from('referral_profiles')
      .insert({
        id: userId,
        email,
        referral_code: candidate,
        wallet_balance: 0,
        lifetime_referrals: 0,
        quarterly_referrals: 0,
      })
      .select()
      .single()
    if (!error) return data

    if ((error as any).code === '23505') {
      // A row for this user/email was created concurrently: use it.
      const existing = await findProfile(db, email)
      if (existing) return existing
      const { data: byId } = await db.from('referral_profiles').select('*').eq('id', userId).maybeSingle()
      if (byId) return byId
      continue // code collided at insert time: try another code
    }
    throw error
  }
  throw new Error('Could not allocate a unique referral code')
}

async function loadHistory(db: Db, email: string) {
  const { data, error } = await db
    .from('referral_transactions')
    .select('*')
    .ilike('referrer_email', escapeLike(email))
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    console.error('[site:me/referral] history error:', error.message)
    return []
  }
  return data || []
}

async function loadMilestones(db: Db) {
  const { data, error } = await db
    .from('referral_milestones')
    .select('referrals_required, bonus_coins')
    .order('referrals_required', { ascending: true })
  if (error) return DEFAULT_MILESTONES
  return data || []
}

/**
 * GET /api/site/me/referral
 * The signed-in user's referral profile (created on first visit), referral history and milestones.
 * Always scoped to the class session email; nothing in the request selects the user.
 */
export async function GET() {
  if (!isStorefrontConfigured()) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
  }
  const session = await getSession()
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 })
  }

  const email = session.email.trim().toLowerCase()
  const db = storefrontDb()

  try {
    const [existing, history, milestones] = await Promise.all([
      findProfile(db, email),
      loadHistory(db, email),
      loadMilestones(db),
    ])

    const profile = existing ? await applyQuarterlyReset(db, existing) : await createProfile(db, email, session.name || '')

    return NextResponse.json(
      {
        profile: profile || null,
        history,
        milestones,
        ...(profile ? {} : { reason: NO_STOREFRONT_ACCOUNT }),
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (err: any) {
    console.error('[site:me/referral] error:', err?.message || 'unknown')
    return NextResponse.json({ error: 'Failed to load referral profile' }, { status: 500 })
  }
}
