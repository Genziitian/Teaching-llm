import { prisma } from '@/lib/db'
import { LOADING_FACTS, LoadingFactRarity } from './loading-facts-data'

let tableEnsured = false

function bundledRows() {
  const now = new Date()
  return LOADING_FACTS.map(fact => ({
    id: `lf_${fact.id}`,
    code: fact.id,
    text: fact.text,
    rarity: fact.rarity,
    isCoupon: !!fact.isCoupon,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }))
}

export function getBundledFactCounts() {
  const counts = { all: LOADING_FACTS.length, COMMON: 0, RARE: 0, ULTRA_RARE: 0, active: LOADING_FACTS.length }
  for (const fact of LOADING_FACTS) {
    counts[fact.rarity] += 1
  }
  return counts
}

export function getBundledFactsPayload(options?: {
  q?: string
  rarity?: string
  page?: number
  limit?: number
}) {
  const q = (options?.q || '').trim().toLowerCase()
  const rarity = options?.rarity || ''
  const page = Math.max(1, options?.page || 1)
  const limit = Math.min(100, Math.max(10, options?.limit || 50))

  let facts = LOADING_FACTS.map(fact => ({
    id: fact.id,
    code: fact.id,
    text: fact.text,
    rarity: fact.rarity as LoadingFactRarity,
    isCoupon: !!fact.isCoupon,
    isActive: true,
    createdAt: new Date(0).toISOString(),
  }))

  if (q) facts = facts.filter(fact => fact.text.toLowerCase().includes(q))
  if (rarity && ['COMMON', 'RARE', 'ULTRA_RARE'].includes(rarity)) {
    facts = facts.filter(fact => fact.rarity === rarity)
  }

  const total = facts.length
  const start = (page - 1) * limit
  return {
    facts: facts.slice(start, start + limit),
    total,
    page,
    limit,
    counts: getBundledFactCounts(),
    source: 'bundled' as const,
  }
}

async function ensureLoadingFactTable() {
  if (tableEnsured) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LoadingFact" (
      "id" TEXT NOT NULL,
      "code" TEXT,
      "text" TEXT NOT NULL,
      "rarity" TEXT NOT NULL DEFAULT 'COMMON',
      "isCoupon" BOOLEAN NOT NULL DEFAULT false,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LoadingFact_pkey" PRIMARY KEY ("id")
    );
  `)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "LoadingFact_code_key" ON "LoadingFact"("code");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LoadingFact_rarity_idx" ON "LoadingFact"("rarity");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LoadingFact_isActive_idx" ON "LoadingFact"("isActive");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LoadingFact_createdAt_idx" ON "LoadingFact"("createdAt");`)
  tableEnsured = true
}

export async function ensureLoadingFactsSeeded() {
  await ensureLoadingFactTable()

  const existing = await prisma.loadingFact.findMany({
    select: { code: true },
  })
  const existingCodes = new Set(existing.map(row => row.code).filter(Boolean))
  const missing = bundledRows().filter(row => !existingCodes.has(row.code))

  if (missing.length === 0) {
    return { seeded: false, count: existing.length }
  }

  await prisma.loadingFact.createMany({
    data: missing,
    skipDuplicates: true,
  })

  return { seeded: true, count: existing.length + missing.length }
}
