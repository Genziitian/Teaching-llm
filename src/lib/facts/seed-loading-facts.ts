import { prisma } from '@/lib/db'
import { LOADING_FACTS } from './loading-facts-data'

export async function ensureLoadingFactsSeeded() {
  const count = await prisma.loadingFact.count()
  if (count > 0) return { seeded: false, count }

  await prisma.loadingFact.createMany({
    data: LOADING_FACTS.map(fact => ({
      code: fact.id,
      text: fact.text,
      rarity: fact.rarity,
      isCoupon: !!fact.isCoupon,
      isActive: true,
    })),
    skipDuplicates: true,
  })

  return { seeded: true, count: LOADING_FACTS.length }
}
