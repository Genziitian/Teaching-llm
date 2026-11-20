import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { escapeLike } from '@/lib/site/http'

export const dynamic = 'force-dynamic'

const QUARTER_DAYS = 90

/**
 * GET /api/site/referral[?email=...]
 * The signed-in user's referral profile (or null if none yet). Managers may look up any email;
 * everyone else may only read their own, and the session email is what gets queried.
 */
export async function GET(request: NextRequest) {
  if (!isStorefrontConfigured()) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
  }

  const session = await getSession()
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 })
  }

  const sessionEmail = session.email.trim().toLowerCase()
  const requested = (request.nextUrl.searchParams.get('email') || '').trim().toLowerCase()
  const isManager = session.role === 'MANAGER'

  if (requested && requested !== sessionEmail && !isManager) {
    return NextResponse.json({ error: 'Forbidden: You can only view your own referral profile' }, { status: 403 })
  }
  const email = requested && isManager ? requested : sessionEmail

  try {
    const supabase = storefrontDb()
    const { data: profile, error } = await supabase
      .from('referral_profiles')
      .select('*')
      .ilike('email', escapeLike(email))
      .limit(1)
      .maybeSingle()
    if (error) throw error

    if (!profile) {
      // Profile doesn't exist yet; the profile page creates it.
      return NextResponse.json(null, { headers: { 'Cache-Control': 'no-store' } })
    }

    // Lazy quarterly reset
    const quarterStart = new Date(profile.quarter_start_date)
    const now = new Date()
    const diffDays = (now.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24)

    if (!Number.isFinite(diffDays) || diffDays >= QUARTER_DAYS) {
      const { data: updated, error: updateError } = await supabase
        .from('referral_profiles')
        .update({ quarterly_referrals: 0, quarter_start_date: now.toISOString() })
        .eq('id', profile.id)
        .select()
        .single()
      if (updateError) throw updateError
      return NextResponse.json(updated, { headers: { 'Cache-Control': 'no-store' } })
    }

    return NextResponse.json(profile, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    console.error('[site:referral] error:', err?.message || 'unknown')
    return NextResponse.json({ error: 'Failed to load referral profile' }, { status: 500 })
  }
}
