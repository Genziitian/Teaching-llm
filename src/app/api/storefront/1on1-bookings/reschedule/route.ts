import { NextResponse } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { requireManager, storefrontError } from '@/lib/storefront/guard'
import { dispatch1on1Webhook, findBooking, readBody, updateBookingRow } from '@/lib/storefront/bookings/helpers'

export const dynamic = 'force-dynamic'

// POST { id, new_slot_date, new_slot_time, reason?, manager_notes? }
// Note: the original performs no slot-conflict check on reschedule, so none is added here.
export async function POST(request: Request) {
  const g = await requireManager()
  if ('response' in g) return g.response
  try {
    const { id, new_slot_date, new_slot_time, reason = 'Rescheduled', manager_notes } = await readBody(request)
    if (!id || !new_slot_date || !new_slot_time) {
      return NextResponse.json({ error: 'Booking ID, new date, and new slot time are required' }, { status: 400 })
    }
    const db = storefrontDb()
    const rescheduleNote = manager_notes || reason || 'Rescheduled'
    const { booking, row } = await findBooking(db, id)
    let previous_slot_date = row?.slot_date || ''
    let previous_slot_time = row?.slot_time || ''

    await updateBookingRow(db, id, { slot_date: new_slot_date, slot_time: new_slot_time, status: 'RESCHEDULED', manager_notes: rescheduleNote })

    if (booking) {
      try {
        await db.from('activity_logs').insert({
          email: booking.email,
          action: '1ON1_SLOT_RESCHEDULED',
          metadata: {
            id,
            previous_slot_date,
            previous_slot_time,
            new_slot_date,
            new_slot_time,
            manager_notes: rescheduleNote,
            user_notes: booking.user_notes || booking.notes || '',
          },
        })
      } catch {}

      previous_slot_date = previous_slot_date || booking.slot_date
      previous_slot_time = previous_slot_time || booking.slot_time
      booking.slot_date = new_slot_date
      booking.slot_time = new_slot_time
      booking.status = 'RESCHEDULED'
      booking.manager_notes = rescheduleNote
      booking.user_notes = booking.user_notes || booking.notes || ''
      booking.updated_at = new Date().toISOString()
      await dispatch1on1Webhook({
        type: 'one_on_one_rescheduled',
        ...booking,
        previous_slot_date,
        previous_slot_time,
        new_slot_date,
        new_slot_time,
        reason: rescheduleNote,
      })
    }

    return NextResponse.json({ success: true, message: 'Booking rescheduled successfully. Confirmation email sent.', booking })
  } catch (error) {
    return storefrontError('1on1-bookings:reschedule', error)
  }
}
