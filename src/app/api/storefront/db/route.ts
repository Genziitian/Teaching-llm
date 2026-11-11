// Generic, whitelisted proxy between the moved storefront manager panel (browser) and the
// storefront Supabase project. The browser shim sends a table plus an ordered list of
// supabase-js builder calls; we validate everything, replay them server-side with the
// service-role client, and return a result shaped like supabase-js ({ data, error, count, status }).
import { NextRequest, NextResponse } from 'next/server'
import { storefrontDb } from '@/lib/storefront/db'
import { requireManager, requireSuperManager, storefrontError } from '@/lib/storefront/guard'

export const dynamic = 'force-dynamic'

// Tables the manager panel may touch. Extend here.
const ALLOWED_TABLES = new Set<string>([
  'activity_logs',
  'blogs',
  'cart_followup_calls',
  'coupon_uses',
  'course_catalog',
  'courses',
  'discount_coupons',
  'employee_birth_dates',
  'employee_identity_documents',
  'employee_logs',
  'employee_photos',
  'employees',
  'job_applications',
  'one_on_one_bookings',
  'profiles',
  'referral_milestones',
  'referral_profiles',
  'referral_transactions',
  'settings',
  'website_orders',
])

// Tables holding government ID numbers or birth dates: super-managers only.
const SUPER_MANAGER_TABLES = new Set<string>(['employee_birth_dates', 'employee_identity_documents'])

const ALLOWED_METHODS = new Set<string>([
  'select', 'insert', 'update', 'upsert', 'delete',
  'eq', 'neq', 'in', 'is', 'not', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'or',
  'order', 'range', 'limit', 'single', 'maybeSingle',
])
const FILTER_METHODS = new Set<string>(['eq', 'neq', 'in', 'is', 'not', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'or'])
const WRITE_FILTER_REQUIRED = new Set<string>(['update', 'delete'])

const MAX_CALLS = 25
const MAX_BODY_BYTES = 1024 * 1024
const MAX_DEPTH = 12

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function isJsonValue(v: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH) return false
  if (v === null) return true
  const t = typeof v
  if (t === 'string' || t === 'boolean') return true
  if (t === 'number') return Number.isFinite(v as number)
  if (Array.isArray(v)) return v.every((x) => isJsonValue(x, depth + 1))
  if (t === 'object') {
    const proto = Object.getPrototypeOf(v)
    if (proto !== Object.prototype && proto !== null) return false
    return Object.keys(v as object).every((k) => isJsonValue((v as Record<string, unknown>)[k], depth + 1))
  }
  return false
}

type Call = { m: string; a: unknown[] }

function validate(body: unknown): { table: string; calls: Call[] } | { error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Invalid body' }
  const { table, calls } = body as { table?: unknown; calls?: unknown }
  if (typeof table !== 'string' || !/^[a-z_]+$/.test(table) || !ALLOWED_TABLES.has(table)) {
    return { error: 'Table not allowed' }
  }
  if (!Array.isArray(calls) || calls.length === 0) return { error: 'calls must be a non-empty array' }
  if (calls.length > MAX_CALLS) return { error: `Too many calls (max ${MAX_CALLS})` }

  const out: Call[] = []
  let hasFilter = false
  let hasWriteNeedingFilter = false
  for (const c of calls) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) return { error: 'Invalid call' }
    const { m, a } = c as { m?: unknown; a?: unknown }
    if (typeof m !== 'string' || !ALLOWED_METHODS.has(m)) return { error: 'Method not allowed' }
    if (!Array.isArray(a) || a.length > 5 || !isJsonValue(a)) return { error: 'Invalid call arguments' }
    if (FILTER_METHODS.has(m)) hasFilter = true
    if (WRITE_FILTER_REQUIRED.has(m)) hasWriteNeedingFilter = true
    out.push({ m, a })
  }
  if (out[0].m !== 'select' && !['insert', 'update', 'upsert', 'delete'].includes(out[0].m)) {
    return { error: 'First call must be select, insert, update, upsert or delete' }
  }
  if (hasWriteNeedingFilter && !hasFilter) return { error: 'update/delete requires at least one filter' }
  return { table, calls: out }
}

async function run(v: { table: string; calls: Call[] }): Promise<NextResponse> {
    if (SUPER_MANAGER_TABLES.has(v.table)) {
      const sg = await requireSuperManager()
      if ('response' in sg) return sg.response
    }

    let q: any = storefrontDb().from(v.table)
    for (const c of v.calls) {
      q = q[c.m](...c.a)
    }
    const res = await q
    const err = res?.error
    return NextResponse.json({
      data: res?.data ?? null,
      error: err
        ? { message: err.message ?? 'Error', code: err.code ?? null, details: err.details ?? null, hint: err.hint ?? null }
        : null,
      count: typeof res?.count === 'number' ? res.count : null,
      status: typeof res?.status === 'number' ? res.status : 200,
    })
}

export async function POST(request: NextRequest) {
  try {
    // Parse + validate before auth work, but only act after the guard passes.
    const declared = Number(request.headers.get('content-length') || 0)
    if (declared > MAX_BODY_BYTES) return bad('Request too large', 413)
    const text = await request.text()
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return bad('Request too large', 413)

    const g = await requireManager()
    if ('response' in g) return g.response

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return bad('Invalid JSON')
    }
    const v = validate(parsed)
    if ('error' in v) return bad(v.error)

    return await run(v)
  } catch (error) {
    return storefrontError('db-proxy', error)
  }
}

// Read-only variant: the browser sends select-only chains as GET ?q=<base64url JSON> so plain
// reads are not counted as writes by the global POST rate limit. Writes must use POST.
export async function GET(request: NextRequest) {
  try {
    const g = await requireManager()
    if ('response' in g) return g.response

    const q = new URL(request.url).searchParams.get('q') || ''
    if (!q || q.length > 8000) return bad('Invalid query', q ? 414 : 400)

    let parsed: unknown
    try {
      parsed = JSON.parse(Buffer.from(q, 'base64url').toString('utf8'))
    } catch {
      return bad('Invalid query')
    }
    const v = validate(parsed)
    if ('error' in v) return bad(v.error)
    if (v.calls[0].m !== 'select' || v.calls.some((c) => ['insert', 'update', 'upsert', 'delete'].includes(c.m))) {
      return bad('GET is read-only', 405)
    }
    return await run(v)
  } catch (error) {
    return storefrontError('db-proxy', error)
  }
}
