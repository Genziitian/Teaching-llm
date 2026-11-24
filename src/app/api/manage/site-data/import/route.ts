import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isLegacyDbConfigured, legacyStorefrontDb } from '@/lib/storefront/db'
import { bulkUpsert, siteTable } from '@/lib/site-db/engine'
import { SITE_TABLES } from '@/lib/site-db/tables'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function requireManager() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (s.role !== 'MANAGER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

/** Row counts in the platform database, plus whether the old database can still be read for importing. */
export async function GET() {
  const denied = await requireManager()
  if (denied) return denied
  const counts: Record<string, number> = {}
  for (const t of SITE_TABLES) {
    const r = await siteTable(t).select('*', { count: 'exact', head: true })
    counts[t] = r.count ?? 0
  }
  return NextResponse.json({ tables: SITE_TABLES, counts, legacyConnected: isLegacyDbConfigured() })
}

/** Body: { table, offset? }. Copies up to 2000 rows of one old table, returns where to continue. Safe to repeat. */
export async function POST(req: NextRequest) {
  const denied = await requireManager()
  if (denied) return denied
  try {
    const { table, offset = 0 } = await req.json()
    if (!(SITE_TABLES as readonly string[]).includes(table)) return NextResponse.json({ error: 'Unknown table' }, { status: 400 })
    if (!isLegacyDbConfigured()) return NextResponse.json({ error: 'The old website database is not connected, so there is nothing to import.' }, { status: 400 })
    const PAGE = 500, MAX = 2000
    const db = legacyStorefrontDb()
    let done = 0
    let next: number | null = null
    for (let from = Number(offset) || 0; done < MAX; from += PAGE) {
      const { data, error } = await db.from(table).select('*').range(from, from + PAGE - 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const rows = (data || []) as Record<string, any>[]
      if (rows.length) {
        const w = await bulkUpsert(table, rows)
        if (w.error) return NextResponse.json({ error: w.error }, { status: 500 })
        done += rows.length
      }
      if (rows.length < PAGE) { next = null; break }
      next = from + PAGE
    }
    return NextResponse.json({ table, imported: done, next })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Import failed' }, { status: 500 })
  }
}
