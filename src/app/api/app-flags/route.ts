import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getAppCouponsEnabled } from '@/lib/app-flags'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ couponsEnabled: await getAppCouponsEnabled() })
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { couponsEnabled } = await request.json()
    const on = !!couponsEnabled
    await (prisma as any).appFlags.upsert({
      where: { id: 'singleton' },
      update: { couponsEnabled: on },
      create: { id: 'singleton', couponsEnabled: on },
    })
    return NextResponse.json({ couponsEnabled: on })
  } catch (e) {
    console.error('[app-flags] PUT', e)
    return NextResponse.json({ error: 'Could not save. Run the AppFlags SQL first.' }, { status: 500 })
  }
}
