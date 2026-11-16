import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { storefrontDb } from '@/lib/storefront/db'
import { dispatch1on1Webhook, findBooking, readBody, updateBookingRow } from '@/lib/storefront/bookings/helpers'

export const dynamic = 'force-dynamic'

// POST { id, new_slot_date, new_slot_time, reason? } — student reschedules their own booking.
export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.email) return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 })
  try {
    const { id, new_slot_date, new_slot_time, reason = 'Rescheduled' } = await readBody(request)
    if (!id || !new_slot_date || !new_slot_time) {
      return NextResponse.json({ error: 'Booking ID, new date, and new slot time are required' }, { status: 400 })
    }
    const db = storefrontDb()
    const { booking } = await findBooking(db, id)
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (String(booking.email || '').toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden: You can only reschedule your own bookings' }, { status: 403 })
    }
    const note = String(reason || 'Rescheduled').slice(0, 500)
    const previous_slot_date = booking.slot_date
    const previous_slot_time = booking.slot_time
    await updateBookingRow(db, id, { slot_date: new_slot_date, slot_time: new_slot_time, status: 'RESCHEDULED', manager_notes: note })
    try {
      await db.from('activity_logs').insert({
        email: booking.email, action: '1ON1_SLOT_RESCHEDULED',
        metadata: { id, previous_slot_date, previous_slot_time, new_slot_date, new_slot_time, manager_notes: note, user_notes: booking.user_notes || booking.notes || '' },
      })
    } catch {}
    Object.assign(booking, { slot_date: new_slot_date, slot_time: new_slot_time, status: 'RESCHEDULED', manager_notes: note, updated_at: new Date().toISOString() })
    await dispatch1on1Webhook({ type: 'one_on_one_rescheduled', ...booking, previous_slot_date, previous_slot_time, new_slot_date, new_slot_time, reason: note })
    return NextResponse.json({ success: true, message: 'Booking rescheduled successfully. Confirmation email sent.', booking })
  } catch (err) {
    console.error('[site:1on1-reschedule]', (err as Error).message)
    return NextResponse.json({ error: 'Failed to reschedule booking' }, { status: 500 })
  }
}
