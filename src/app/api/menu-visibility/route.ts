import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getHiddenMenus, setHiddenMenus } from '@/lib/menu-visibility'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ hidden: await getHiddenMenus() })
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const hidden = await setHiddenMenus(Array.isArray(body?.hidden) ? body.hidden : [])
    return NextResponse.json({ hidden })
  } catch (e) {
    console.error('[menu-visibility] PUT', e)
    return NextResponse.json({ error: 'Could not save. Run the hiddenMenus SQL first.' }, { status: 500 })
  }
}
