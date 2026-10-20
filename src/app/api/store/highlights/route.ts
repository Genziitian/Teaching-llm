import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

// Manager-only: save the "What you get" points (one per line) for a course offering or a bundle.
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { kind, id, highlights } = await request.json()
    if (!id || (kind !== 'course' && kind !== 'bundle')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const value = String(highlights || '')
      .split('\n').map((s: string) => s.trim()).filter(Boolean).slice(0, 30).join('\n') || null
    if (kind === 'course') {
      await (prisma.courseOffering as any).update({ where: { id }, data: { highlights: value } })
    } else {
      await (prisma.bundleOffering as any).update({ where: { id }, data: { highlights: value } })
    }
    return NextResponse.json({ success: true, highlights: value })
  } catch (error) {
    console.error('[store/highlights] PUT Error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
