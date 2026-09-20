import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ensureLoadingFactsSeeded } from '@/lib/facts/seed-loading-facts'
import { normalizeFactRarity } from '@/lib/facts/loading-fact-rarity'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ensureLoadingFactsSeeded()

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const rarity = searchParams.get('rarity') || ''
    const active = searchParams.get('active') || 'all'
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') || 50)))

    const where: Record<string, unknown> = {}
    if (q) where.text = { contains: q, mode: 'insensitive' }
    if (rarity && ['COMMON', 'RARE', 'ULTRA_RARE'].includes(rarity)) where.rarity = rarity
    if (active === 'true') where.isActive = true
    if (active === 'false') where.isActive = false

    const [facts, total, commonCount, rareCount, ultraCount, activeCount] = await Promise.all([
      prisma.loadingFact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.loadingFact.count({ where }),
      prisma.loadingFact.count({ where: { rarity: 'COMMON' } }),
      prisma.loadingFact.count({ where: { rarity: 'RARE' } }),
      prisma.loadingFact.count({ where: { rarity: 'ULTRA_RARE' } }),
      prisma.loadingFact.count({ where: { isActive: true } }),
    ])

    return NextResponse.json({
      facts,
      total,
      page,
      limit,
      counts: {
        all: commonCount + rareCount + ultraCount,
        COMMON: commonCount,
        RARE: rareCount,
        ULTRA_RARE: ultraCount,
        active: activeCount,
      },
    })
  } catch (error) {
    console.error('[manage/facts] GET Error:', error)
    return NextResponse.json({ error: 'Failed to fetch facts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const text = String(data.text || '').trim()
    if (!text) {
      return NextResponse.json({ error: 'Fact text is required' }, { status: 400 })
    }

    const fact = await prisma.loadingFact.create({
      data: {
        text,
        rarity: normalizeFactRarity(data.rarity),
        isCoupon: !!data.isCoupon,
        isActive: data.isActive == null ? true : !!data.isActive,
      },
    })

    return NextResponse.json(fact)
  } catch (error) {
    console.error('[manage/facts] POST Error:', error)
    return NextResponse.json({ error: 'Failed to create fact' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json().catch(() => ({}))
    const ids = Array.isArray(data.ids) ? data.ids.filter((id: unknown) => typeof id === 'string') : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No facts selected' }, { status: 400 })
    }

    const result = await prisma.loadingFact.deleteMany({
      where: { id: { in: ids } },
    })

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    console.error('[manage/facts] DELETE Error:', error)
    return NextResponse.json({ error: 'Failed to delete facts' }, { status: 500 })
  }
}
