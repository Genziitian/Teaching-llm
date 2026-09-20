import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { normalizeFactRarity, parseBulkFactLine } from '@/lib/facts/loading-fact-rarity'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const fallbackRarity = normalizeFactRarity(data.rarity)
    const isCoupon = !!data.isCoupon
    const rawLines = Array.isArray(data.facts)
      ? data.facts.map((item: unknown) => String(item || ''))
      : String(data.text || '').split(/\r?\n/)

    const parsed = rawLines
      .map(line => parseBulkFactLine(line, fallbackRarity))
      .filter((item): item is { text: string; rarity: ReturnType<typeof normalizeFactRarity> } => !!item && item.text.length > 0)

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'Paste at least one fact (one per line)' }, { status: 400 })
    }

    const existing = await prisma.loadingFact.findMany({
      where: { text: { in: parsed.map(item => item.text) } },
      select: { text: true },
    })
    const existingSet = new Set(existing.map(item => item.text))
    const unique = parsed.filter(item => !existingSet.has(item.text))

    if (unique.length === 0) {
      return NextResponse.json({ created: 0, skipped: parsed.length, facts: [] })
    }

    await prisma.loadingFact.createMany({
      data: unique.map(item => ({
        text: item.text,
        rarity: item.rarity,
        isCoupon,
        isActive: true,
      })),
    })

    const created = await prisma.loadingFact.findMany({
      where: { text: { in: unique.map(item => item.text) } },
      orderBy: { createdAt: 'desc' },
      take: unique.length,
    })

    return NextResponse.json({
      created: unique.length,
      skipped: parsed.length - unique.length,
      facts: created,
    })
  } catch (error) {
    console.error('[manage/facts/bulk] POST Error:', error)
    return NextResponse.json({ error: 'Failed to bulk add facts' }, { status: 500 })
  }
}
