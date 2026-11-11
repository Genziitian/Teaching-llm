import { NextResponse } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { requireManager, storefrontError } from '@/lib/storefront/guard'
import { dispatch1on1Webhook, findBooking, readBody, updateBookingRow } from '@/lib/storefront/bookings/helpers'

export const dynamic = 'force-dynamic'

// POST { id, reason?, manager_notes? }
export async function POST(request: Request) {
  const g = await requireManager()
  if ('response' in g) return g.response
  try {
    const { id, reason = 'Cancelled by student', manager_notes } = await readBody(request)
    if (!id) return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 })
    const db = storefrontDb()
    const cancellationNote = manager_notes || reason || 'Cancelled'
    const { booking } = await findBooking(db, id)

    await updateBookingRow(db, id, { status: 'CANCELLED', manager_notes: cancellationNote })

    if (booking) {
      try {
        await db.from('activity_logs').insert({
          email: booking.email,
          action: '1ON1_SLOT_CANCELLED',
          metadata: {
            id,
            reason: cancellationNote,
            manager_notes: cancellationNote,
            user_notes: booking.user_notes || booking.notes || '',
            slot_date: booking.slot_date,
            slot_time: booking.slot_time,
          },
        })
      } catch {}

      booking.status = 'CANCELLED'
      booking.manager_notes = cancellationNote
      booking.user_notes = booking.user_notes || booking.notes || ''
      booking.updated_at = new Date().toISOString()
      await dispatch1on1Webhook({ type: 'one_on_one_cancelled', ...booking, reason: cancellationNote })
    }

    return NextResponse.json({ success: true, message: 'Booking cancelled successfully. Cancellation email sent.', booking })
  } catch (error) {
    return storefrontError('1on1-bookings:cancel', error)
  }
}
