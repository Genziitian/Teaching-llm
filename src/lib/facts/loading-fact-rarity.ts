import { LoadingFactRarity } from './loading-facts-data'

export const FACT_RARITIES: LoadingFactRarity[] = ['COMMON', 'RARE', 'ULTRA_RARE']

export const FACT_RARITY_LABELS: Record<LoadingFactRarity, string> = {
  COMMON: 'Common',
  RARE: 'Rare',
  ULTRA_RARE: 'Super Rare',
}

export function normalizeFactRarity(value: unknown): LoadingFactRarity {
  const raw = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (raw === 'RARE') return 'RARE'
  if (raw === 'ULTRA_RARE' || raw === 'SUPER_RARE' || raw === 'ULTRARARE' || raw === 'SUPERRARE') {
    return 'ULTRA_RARE'
  }
  return 'COMMON'
}

export function parseBulkFactLine(line: string, fallbackRarity: LoadingFactRarity) {
  const trimmed = line.replace(/^\s*[-*]\s*/, '').trim()
  if (!trimmed) return null

  const tagged = trimmed.match(/^\[(COMMON|RARE|SUPER\s*RARE|ULTRA[_\s-]?RARE)\]\s*(.+)$/i)
  if (tagged) {
    return {
      text: tagged[2].trim(),
      rarity: normalizeFactRarity(tagged[1]),
    }
  }

  return { text: trimmed, rarity: fallbackRarity }
}
