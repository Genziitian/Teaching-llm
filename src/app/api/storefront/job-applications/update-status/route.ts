import { NextResponse } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { requireManager, storefrontError } from '@/lib/storefront/guard'
import { readBody } from '@/lib/storefront/bookings/helpers'

export const dynamic = 'force-dynamic'

// POST { id, status?, manager_notes? }
export async function POST(request: Request) {
  const g = await requireManager()
  if ('response' in g) return g.response
  try {
    const { id, status, manager_notes } = await readBody(request)
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    const db = storefrontDb()

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
    if (status) updatePayload.status = status
    if (manager_notes !== undefined) updatePayload.manager_notes = manager_notes

    try {
      await db.from('job_applications').update(updatePayload).eq('id', id)
    } catch {}
    try {
      await db.from('activity_logs').insert({
        action: 'JOB_APPLICATION_STATUS_UPDATED',
        metadata: { id, status, manager_notes, timestamp: new Date().toISOString() },
      })
    } catch {}

    return NextResponse.json({ success: true, message: 'Application updated' })
  } catch (error) {
    return storefrontError('job-applications:update-status', error)
  }
}
