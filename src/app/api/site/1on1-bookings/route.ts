import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { loadLogBookings, type Booking } from '@/lib/storefront/bookings/helpers'

export const dynamic = 'force-dynamic'

// GET /api/site/1on1-bookings — the signed-in student's own 1:1 bookings (email param ignored).
export async function GET() {
  const session = await getSession()
  if (!session?.email) return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 })
  if (!isStorefrontConfigured()) return NextResponse.json({ success: true, bookings: [] })
  try {
    const email = session.email.trim().toLowerCase()
    const db = storefrontDb()
    const combined = new Map<string, Booking>()
    for (const b of await loadLogBookings(db, email)) if (b?.id) combined.set(b.id, b)
    const { data } = await db.from('one_on_one_bookings').select('*').eq('email', email).order('created_at', { ascending: false })
    for (const b of data || []) if (b?.id) combined.set(b.id, b)
    const bookings = Array.from(combined.values())
      .map((b): Booking => ({ ...b, user_notes: b.user_notes || b.notes || '', manager_notes: b.manager_notes || '' }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return NextResponse.json({ success: true, bookings })
  } catch (err) {
    console.error('[site:1on1-bookings]', (err as Error).message)
    return NextResponse.json({ error: 'Failed to fetch 1:1 bookings' }, { status: 500 })
  }
}
