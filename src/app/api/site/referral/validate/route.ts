import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/site/referral/validate?code=XXXXX
 * Public: says whether a referral code exists. Never reveals the referrer's email; when the
 * caller is signed in it also says whether the code is the caller's own (`own`).
 */
export async function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get('code') || '').trim().toUpperCase()
  if (!code || code.length > 64) return NextResponse.json({ valid: false }, { status: 400 })

  if (!isStorefrontConfigured()) {
    return NextResponse.json({ valid: false }, { status: 500 })
  }

  try {
    const { data, error } = await storefrontDb()
      .from('referral_profiles')
      .select('referral_code, email')
      .eq('referral_code', code)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ valid: false }, { headers: { 'Cache-Control': 'no-store' } })

    const session = await getSession().catch(() => null)
    const own = Boolean(
      session?.email && String((data as any).email || '').trim().toLowerCase() === session.email.trim().toLowerCase()
    )
    return NextResponse.json({ valid: true, own }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    console.error('[site:referral/validate] error:', err?.message || 'unknown')
    return NextResponse.json({ valid: false }, { status: 500 })
  }
}
