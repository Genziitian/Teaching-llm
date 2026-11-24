import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { storefrontDb } from '@/lib/storefront/db'
import { findBooking, readBody, updateBookingRow } from '@/lib/storefront/bookings/helpers'

export const dynamic = 'force-dynamic'

// POST { id, name, phone, level, subjects, user_notes } — student edits the details of their own upcoming booking.
// (Date and time changes stay in /reschedule.)
export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.email) return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 })
  try {
    const b = await readBody(request)
    if (!b.id) return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 })
    const db = storefrontDb()
    const { booking } = await findBooking(db, b.id)
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (String(booking.email || '').toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden: You can only edit your own bookings' }, { status: 403 })
    }
    if (!['CONFIRMED', 'RESCHEDULED'].includes(String(booking.status))) {
      return NextResponse.json({ error: 'Only upcoming bookings can be edited' }, { status: 400 })
    }
    const name = String(b.name || '').trim().slice(0, 100)
    const phone = String(b.phone || '').replace(/\D/g, '').slice(-10)
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (phone.length !== 10) return NextResponse.json({ error: 'Enter a 10 digit phone number' }, { status: 400 })
    const list = (Array.isArray(b.subjects) ? b.subjects : String(b.subjects || '').split(',')).map((s: any) => String(s).trim()).filter(Boolean).slice(0, 10)
    const fields = {
      name, phone,
      level: String(b.level || '').trim().slice(0, 40),
      subjects: Array.isArray((booking as any).subjects) ? list : list.join(', '),
      user_notes: String(b.user_notes || '').slice(0, 1000),
    }
    await updateBookingRow(db, b.id, fields)
    try {
      await db.from('activity_logs').insert({ email: booking.email, action: '1ON1_DETAILS_EDITED', metadata: { id: b.id } })
    } catch {}
    return NextResponse.json({ success: true, booking: { ...booking, ...fields, updated_at: new Date().toISOString() } })
  } catch (err) {
    console.error('[site:1on1-update]', (err as Error).message)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}
