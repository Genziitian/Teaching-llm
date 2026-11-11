import { NextResponse } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { requireManager, storefrontError } from '@/lib/storefront/guard'
import { findBooking, readBody, updateBookingRow } from '@/lib/storefront/bookings/helpers'

export const dynamic = 'force-dynamic'

// POST { id, manager_notes? }
export async function POST(request: Request) {
  const g = await requireManager()
  if ('response' in g) return g.response
  try {
    const { id, manager_notes = '' } = await readBody(request)
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    const db = storefrontDb()
    const { booking } = await findBooking(db, id)

    await updateBookingRow(db, id, { manager_notes })
    try {
      await db.from('activity_logs').insert({
        email: booking?.email,
        action: '1ON1_STATUS_UPDATED',
        metadata: { id, status: booking?.status, manager_notes, user_notes: booking?.user_notes || booking?.notes || '' },
      })
    } catch {}

    if (booking) {
      booking.manager_notes = manager_notes
      booking.user_notes = booking.user_notes || booking.notes || ''
      booking.updated_at = new Date().toISOString()
    }
    return NextResponse.json({ success: true, message: 'Notes saved successfully', booking })
  } catch (error) {
    return storefrontError('1on1-bookings:update-notes', error)
  }
}
