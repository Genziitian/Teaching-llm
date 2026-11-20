import { NextResponse } from 'next/server'
import { requireSupportSession } from '@/lib/support-ticket-access'
import { loadGraph, seedIfEmpty } from '@/lib/genie/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireSupportSession()
    if (auth.error) return auth.error
    if (auth.session!.role !== 'MANAGER') return NextResponse.json({ error: 'Managers only' }, { status: 403 })
    const seeded = await seedIfEmpty()
    return NextResponse.json({ ...(await loadGraph()), seeded })
  } catch (e) {
    console.error('genie graph', e)
    return NextResponse.json({ error: 'Genie tables are not ready. Run the database migrations first.' }, { status: 500 })
  }
}
