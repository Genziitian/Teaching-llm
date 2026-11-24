import { NextRequest, NextResponse } from 'next/server'
import { siteTable } from '@/lib/site-db/engine'

export const dynamic = 'force-dynamic'

// Public, read-only lookups the website pages make from the browser (settings, blogs ...).
// Same envelope the browser shim sends: GET ?q=<base64url JSON { table, calls }>. Anything else needs a manager.
const TABLES = new Set(['settings', 'blogs', 'course_catalog', 'widgets', 'resources', 'pseo_pages'])
const METHODS = new Set(['select', 'eq', 'neq', 'in', 'is', 'not', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'or', 'order', 'range', 'limit', 'single', 'maybeSingle'])

export async function GET(request: NextRequest) {
  const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s })
  const q = new URL(request.url).searchParams.get('q') || ''
  if (!q || q.length > 8000) return bad('Invalid query')
  let parsed: any
  try { parsed = JSON.parse(Buffer.from(q, 'base64url').toString('utf8')) } catch { return bad('Invalid query') }
  const { table, calls } = parsed || {}
  if (typeof table !== 'string' || !TABLES.has(table)) return bad('Table not allowed', 403)
  if (!Array.isArray(calls) || calls.length === 0 || calls.length > 20 || calls[0]?.m !== 'select') return bad('Invalid calls')
  for (const c of calls) {
    if (!c || !METHODS.has(c.m) || !Array.isArray(c.a) || c.a.length > 5) return bad('Method not allowed', 403)
  }
  let b: any = siteTable(table)
  for (const c of calls) b = b[c.m](...c.a)
  const res = await b
  return NextResponse.json(
    { data: res.data ?? null, error: res.error, count: res.count ?? null, status: res.status ?? 200 },
    { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } },
  )
}
