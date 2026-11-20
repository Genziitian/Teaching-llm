import { NextResponse } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { requireManager, storefrontError } from '@/lib/storefront/guard'
import { loadLogBookings } from '@/lib/storefront/bookings/helpers'

export const dynamic = 'force-dynamic'

// GET ?email= (optional filter): all bookings, table rows overriding ledger replay.
export async function GET(request: Request) {
  const g = await requireManager()
  if ('response' in g) return g.response
  try {
    const db = storefrontDb()
    const emailParam = new URL(request.url).searchParams.get('email')
    const studentEmail = emailParam ? emailParam.trim().toLowerCase() : null

    let dbBookings: any[] = []
    try {
      let q = db.from('one_on_one_bookings').select('*').order('created_at', { ascending: false })
      if (studentEmail) q = q.eq('email', studentEmail)
      const { data, error } = await q
      if (!error && Array.isArray(data)) dbBookings = data
    } catch {}

    let logBookings: any[] = []
    try {
      logBookings = await loadLogBookings(db, studentEmail)
    } catch (e) {
      console.warn('[storefront:1on1] activity_logs fetch warning:', (e as Error).message)
    }

    const combined = new Map<string, any>()
    logBookings.forEach((b) => b?.id && combined.set(b.id, b))
    dbBookings.forEach((b) => b?.id && combined.set(b.id, b))

    const bookings = Array.from(combined.values())
      .map((b) => ({ ...b, user_notes: b.user_notes || b.notes || '', manager_notes: b.manager_notes || '' }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return NextResponse.json({ success: true, bookings })
  } catch (error) {
    return storefrontError('1on1-bookings:list', error)
  }
}
