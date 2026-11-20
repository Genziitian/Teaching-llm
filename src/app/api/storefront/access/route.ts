import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isPanelOpenToAll } from '@/lib/storefront/guard'

export const dynamic = 'force-dynamic'

// Tells the panel UI whether this visitor may open it. The real checks are on each API route.
export async function GET() {
  const session = await getSession()
  const open = isPanelOpenToAll()
  const allowed = Boolean(session && (session.role === 'MANAGER' || open))
  return NextResponse.json({ allowed, open, role: session?.role ?? null })
}
