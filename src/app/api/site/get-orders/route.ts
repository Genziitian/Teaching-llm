import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { escapeLike } from '@/lib/site/http'

export const dynamic = 'force-dynamic'

// GET /api/site/get-orders?email=... -- returns ONLY the signed-in user's orders (newest first).
// The email query param is accepted for compatibility with the storefront client but never trusted.
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  if (!isStorefrontConfigured()) {
    return NextResponse.json({ error: 'Server configuration missing' }, { status: 500 })
  }

  const session = await getSession()
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized: Missing auth token' }, { status: 401 })
  }

  // Users can only query their own orders: always use the session email.
  const sessionEmail = session.email.trim()

  const { data, error } = await storefrontDb()
    .from('website_orders')
    .select('*')
    .ilike('user_email', escapeLike(sessionEmail))
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Get orders error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [], { status: 200 })
}
