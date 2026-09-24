import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ensureLoadingFactsSeeded } from '@/lib/facts/seed-loading-facts'
import { LOADING_FACTS } from '@/lib/facts/loading-facts-data'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      await ensureLoadingFactsSeeded()
      const facts = await prisma.loadingFact.findMany({
        where: { isActive: true },
        select: { id: true, text: true, rarity: true, isCoupon: true },
        orderBy: { createdAt: 'asc' },
      })
      if (facts.length > 0) {
        return NextResponse.json({ facts })
      }
    } catch (error) {
      console.error('[facts] Database Error:', error)
    }

    return NextResponse.json({
      facts: LOADING_FACTS.map(fact => ({
        id: fact.id,
        text: fact.text,
        rarity: fact.rarity,
        isCoupon: !!fact.isCoupon,
      })),
    })
  } catch (error) {
    console.error('[facts] GET Error:', error)
    return NextResponse.json({ error: 'Failed to fetch facts' }, { status: 500 })
  }
}
