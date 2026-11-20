import { NextResponse } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { requireManager, storefrontError } from '@/lib/storefront/guard'
import { dispatch1on1Webhook, findBooking, readBody, updateBookingRow } from '@/lib/storefront/bookings/helpers'

export const dynamic = 'force-dynamic'

// POST { id, status, manager_notes?, notes? }
export async function POST(request: Request) {
  const g = await requireManager()
  if ('response' in g) return g.response
  try {
    const { id, status, manager_notes, notes } = await readBody(request)
    if (!id || !status) return NextResponse.json({ error: 'ID and status are required' }, { status: 400 })
    const db = storefrontDb()
    const { booking } = await findBooking(db, id)
    const resolvedManagerNote =
      manager_notes !== undefined ? manager_notes : notes !== undefined ? notes : booking?.manager_notes || ''

    await updateBookingRow(db, id, { status, manager_notes: resolvedManagerNote })
    try {
      await db.from('activity_logs').insert({
        email: booking?.email,
        action: '1ON1_STATUS_UPDATED',
        metadata: { id, status, manager_notes: resolvedManagerNote, user_notes: booking?.user_notes || booking?.notes || '' },
      })
    } catch {}

    if (booking) {
      booking.status = status
      booking.manager_notes = resolvedManagerNote
      booking.user_notes = booking.user_notes || booking.notes || ''
      booking.updated_at = new Date().toISOString()
      // Original fires these without awaiting; awaited here so serverless does not drop the request.
      if (status === 'CANCELLED') {
        await dispatch1on1Webhook({ type: 'one_on_one_cancelled', ...booking, reason: resolvedManagerNote || 'Cancelled by manager' })
      } else if (status === 'RESCHEDULED') {
        await dispatch1on1Webhook({ type: 'one_on_one_rescheduled', ...booking })
      }
    }

    return NextResponse.json({ success: true, message: `Booking status updated to ${status}`, booking })
  } catch (error) {
    return storefrontError('1on1-bookings:update-status', error)
  }
}
