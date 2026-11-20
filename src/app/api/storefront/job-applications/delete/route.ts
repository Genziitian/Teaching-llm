import { NextResponse } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { requireManager, storefrontError } from '@/lib/storefront/guard'
import { readBody } from '@/lib/storefront/bookings/helpers'

export const dynamic = 'force-dynamic'

// POST { id }
export async function POST(request: Request) {
  const g = await requireManager()
  if ('response' in g) return g.response
  try {
    const { id } = await readBody(request)
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    const db = storefrontDb()
    try {
      await db.from('job_applications').delete().eq('id', id)
    } catch {}
    return NextResponse.json({ success: true, message: 'Application deleted' })
  } catch (error) {
    return storefrontError('job-applications:delete', error)
  }
}
