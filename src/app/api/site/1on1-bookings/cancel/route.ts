import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { storefrontDb } from '@/lib/storefront/db'
import { dispatch1on1Webhook, findBooking, readBody, updateBookingRow } from '@/lib/storefront/bookings/helpers'

export const dynamic = 'force-dynamic'

// POST { id, reason? } — student cancels their own booking.
export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.email) return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 })
  try {
    const { id, reason = 'Cancelled by student' } = await readBody(request)
    if (!id) return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 })
    const db = storefrontDb()
    const { booking } = await findBooking(db, id)
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (String(booking.email || '').toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden: You can only cancel your own bookings' }, { status: 403 })
    }
    const note = String(reason || 'Cancelled').slice(0, 500)
    await updateBookingRow(db, id, { status: 'CANCELLED', manager_notes: note })
    try {
      await db.from('activity_logs').insert({
        email: booking.email, action: '1ON1_SLOT_CANCELLED',
        metadata: { id, reason: note, manager_notes: note, user_notes: booking.user_notes || booking.notes || '', slot_date: booking.slot_date, slot_time: booking.slot_time },
      })
    } catch {}
    Object.assign(booking, { status: 'CANCELLED', manager_notes: note, updated_at: new Date().toISOString() })
    await dispatch1on1Webhook({ type: 'one_on_one_cancelled', ...booking, reason: note })
    return NextResponse.json({ success: true, message: 'Booking cancelled successfully. Cancellation email sent.', booking })
  } catch (err) {
    console.error('[site:1on1-cancel]', (err as Error).message)
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
  }
}
