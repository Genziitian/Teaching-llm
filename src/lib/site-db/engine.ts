// Supabase-style query builder over the platform database.
// The former website tables live in "SiteRow" (tableName + JSON row). The same calls the website code already
// makes (.from(t).select().eq().order()... / insert / update / upsert / delete) run here, so nothing upstream changes.
//
// Known limits (JSON rows, not real columns): only the primary key is unique; embedded selects like
// select('*, other(*)') return plain rows; dates compare as ISO text.
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'

type Row = Record<string, any>
type Err = { message: string; code?: string; details?: string | null; hint?: string | null }
type Result = { data: any; error: Err | null; count: number | null; status: number }

// Primary key columns per table (default: id).
const PK: Record<string, string[]> = {
  settings: ['key'],
  employee_photos: ['employee_id'],
  employee_birth_dates: ['employee_id'],
  employee_identity_documents: ['employee_id'],
  coupon_uses: ['code', 'user_email'],
}
export const pkOf = (table: string) => PK[table] ?? ['id']

const NUM = `'^-?[0-9]+(\\.[0-9]+)?$'`

class Params {
  list: any[] = []
  add(v: any) { this.list.push(v); return `$${this.list.length}` }
}

/** SQL for one column comparison. `col` is bound as a parameter, never concatenated. */
function cond(p: Params, col: string, op: string, val: any): string {
  const c = p.add(col)
  const text = `("data" ->> ${c})`
  const num = `(CASE WHEN ${text} ~ ${NUM} THEN ${text}::numeric END)`
  const isNum = typeof val === 'number'
  switch (op) {
    case 'eq':
      if (val === null) return `${text} IS NULL`
      return isNum ? `${num} = ${p.add(val)}::numeric` : `${text} = ${p.add(String(val))}`
    case 'neq':
      if (val === null) return `${text} IS NOT NULL`
      return isNum ? `${num} <> ${p.add(val)}::numeric` : `${text} <> ${p.add(String(val))}`
    case 'gt': case 'gte': case 'lt': case 'lte': {
      const sym = { gt: '>', gte: '>=', lt: '<', lte: '<=' }[op]
      return isNum ? `${num} ${sym} ${p.add(val)}::numeric` : `${text} ${sym} ${p.add(String(val))}`
    }
    case 'like': return `${text} LIKE ${p.add(String(val))}`
    case 'ilike': return `${text} ILIKE ${p.add(String(val))}`
    case 'is':
      if (val === null || val === 'null') return `${text} IS NULL`
      return `${text} = ${p.add(String(val))}`
    case 'in': {
      const arr: any[] = Array.isArray(val) ? val : []
      if (arr.length === 0) return 'FALSE'
      return arr.every((x) => typeof x === 'number')
        ? `${num} = ANY(${p.add(arr)}::numeric[])`
        : `${text} = ANY(${p.add(arr.map(String))}::text[])`
    }
    case 'contains':
      return `("data" -> ${c}) @> ${p.add(JSON.stringify(Array.isArray(val) ? val : [val]))}::jsonb`
    default:
      throw new Error(`Unsupported filter: ${op}`)
  }
}

/** Parse the value of a PostgREST-style "col.op.value" string. */
function parseVal(op: string, raw: string): any {
  if (op === 'in') return raw.replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, ''))
  if (op === 'is') return raw === 'null' ? null : raw
  if (['gt', 'gte', 'lt', 'lte'].includes(op) && /^-?\d+(\.\d+)?$/.test(raw)) return Number(raw)
  return raw
}

/** Split "a.eq.1,b.in.(x,y)" on top-level commas. */
function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

function orCond(p: Params, expr: string): string {
  const parts = splitTop(expr).map((item) => {
    const i = item.indexOf('.'), j = item.indexOf('.', i + 1)
    const col = item.slice(0, i), op = item.slice(i + 1, j), raw = item.slice(j + 1)
    return `(${cond(p, col, op, parseVal(op, raw))})`
  })
  return parts.length ? `(${parts.join(' OR ')})` : 'TRUE'
}

type Call = { m: string; a: any[] }

async function run(table: string, calls: Call[]): Promise<Result> {
  const fail = (e: any, code?: string): Result => ({ data: null, error: { message: e?.message || String(e), code }, count: null, status: 400 })
  try {
    let mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
    let payload: any = null
    let opts: any = {}
    let selectCols = '*'
    let selectOpts: any = {}
    let returning = false
    let single: 'single' | 'maybe' | null = null
    let from = 0, to: number | null = null
    const where: string[] = []
    const orders: { col: string; asc: boolean }[] = []
    const p = new Params()
    const tbl = p.add(table)

    for (const c of calls) {
      const [a0, a1, a2] = c.a
      switch (c.m) {
        case 'select':
          if (mode === 'select') { selectCols = a0 ?? '*'; selectOpts = a1 ?? {} } else { returning = true; selectCols = a0 ?? '*' }
          break
        case 'insert': mode = 'insert'; payload = a0; break
        case 'update': mode = 'update'; payload = a0; break
        case 'upsert': mode = 'upsert'; payload = a0; opts = a1 ?? {}; break
        case 'delete': mode = 'delete'; break
        case 'eq': case 'neq': case 'gt': case 'gte': case 'lt': case 'lte': case 'like': case 'ilike': case 'is': case 'in': case 'contains':
          where.push(cond(p, a0, c.m, a1)); break
        case 'not': {
          const val = a1 === 'in' && typeof a2 === 'string' ? parseVal('in', a2) : a2
          where.push(`NOT (${cond(p, a0, a1, a1 === 'is' ? (a2 === null || a2 === 'null' ? null : a2) : val)})`)
          break
        }
        case 'filter': where.push(cond(p, a0, a1, parseVal(a1, String(a2)))); break
        case 'or': where.push(orCond(p, String(a0))); break
        case 'order': orders.push({ col: a0, asc: a1?.ascending !== false }); break
        case 'range': from = a0; to = a1; break
        case 'limit': to = from + a0 - 1; break
        case 'single': single = 'single'; break
        case 'maybeSingle': single = 'maybe'; break
        default: throw new Error(`Unsupported call: ${c.m}`)
      }
    }

    const whereSql = `"tableName" = ${tbl}${where.length ? ' AND ' + where.map((w) => `(${w})`).join(' AND ') : ''}`
    const baseParams = p.list.slice() // parameters used by the WHERE part only (ORDER BY adds more)
    const project = (rows: Row[]) => {
      if (selectCols === '*' || selectCols.includes('(')) return rows
      const cols = selectCols.split(',').map((s: string) => s.trim().split(':').pop()!.trim()).filter(Boolean)
      return rows.map((r) => Object.fromEntries(cols.map((k: string) => [k, r[k] ?? null])))
    }
    const done = (rows: Row[], count: number | null): Result => {
      if (single) {
        if (rows.length === 1) return { data: rows[0], error: null, count, status: 200 }
        if (rows.length === 0 && single === 'maybe') return { data: null, error: null, count, status: 200 }
        return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, count, status: 406 }
      }
      return { data: rows, error: null, count, status: 200 }
    }

    if (mode === 'select') {
      if (selectOpts.head) {
        const n = (await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint AS n FROM "SiteRow" WHERE ${whereSql}`, ...baseParams))[0]?.n ?? BigInt(0)
        return { data: null, error: null, count: Number(n), status: 200 }
      }
      let sql = `SELECT "data" FROM "SiteRow" WHERE ${whereSql}`
      if (orders.length) {
        sql += ' ORDER BY ' + orders.map((o) => {
          const c = p.add(o.col)
          const dir = o.asc ? 'ASC' : 'DESC'
          // Numbers sort numerically, everything else as text.
          return `(CASE WHEN ("data" ->> ${c}) ~ ${NUM} THEN ("data" ->> ${c})::numeric END) ${dir} NULLS LAST, ("data" ->> ${c}) ${dir} NULLS LAST`
        }).join(', ')
      }
      const lim = single ? 2 : to == null ? null : to - from + 1
      if (lim != null) sql += ` LIMIT ${Math.max(0, Math.floor(lim))}`
      if (from) sql += ` OFFSET ${Math.max(0, Math.floor(from))}`
      const rows = (await prisma.$queryRawUnsafe<{ data: Row }[]>(sql, ...p.list)).map((r) => r.data)
      let count: number | null = null
      if (selectOpts.count) {
        const n = (await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint AS n FROM "SiteRow" WHERE ${whereSql}`, ...baseParams))[0]?.n
        count = Number(n ?? 0)
      }
      return done(project(rows), count)
    }

    if (mode === 'delete') {
      const rows = (await prisma.$queryRawUnsafe<{ data: Row }[]>(`DELETE FROM "SiteRow" WHERE ${whereSql} RETURNING "data"`, ...p.list)).map((r) => r.data)
      return returning || single ? done(project(rows), null) : { data: null, error: null, count: null, status: 204 }
    }

    if (mode === 'update') {
      const rows = (await prisma.$queryRawUnsafe<{ data: Row }[]>(
        `UPDATE "SiteRow" SET "data" = "data" || ${p.add(JSON.stringify(payload ?? {}))}::jsonb, "updatedAt" = now() WHERE ${whereSql} RETURNING "data"`, ...p.list)).map((r) => r.data)
      return returning || single ? done(project(rows), null) : { data: null, error: null, count: null, status: 204 }
    }

    // insert / upsert
    const items: Row[] = (Array.isArray(payload) ? payload : [payload]).map((r: Row) => ({ ...r }))
    const pk = pkOf(table)
    const out: Row[] = []
    for (const row of items) {
      if (row.created_at === undefined && !pk.every((k) => row[k] !== undefined && table === 'settings')) row.created_at = new Date().toISOString()
      for (const k of pk) {
        if (row[k] === undefined || row[k] === null) {
          if (k !== 'id') throw new Error(`Missing ${k}`)
          // Tables that used a numeric serial id keep counting up; others get a uuid.
          const max = (await prisma.$queryRawUnsafe<{ m: bigint | null }[]>(
            `SELECT MAX(("data"->>'id')::bigint) AS m FROM "SiteRow" WHERE "tableName" = $1 AND "data"->>'id' ~ '^[0-9]+$'`, table))[0]?.m
          row.id = max != null ? Number(max) + 1 : randomUUID()
        }
      }
      const key = pk.map((k) => String(row[k])).join('|')
      if (mode === 'insert') {
        try {
          await prisma.$executeRawUnsafe(`INSERT INTO "SiteRow"("tableName","rowKey","data") VALUES ($1,$2,$3::jsonb)`, table, key, JSON.stringify(row))
        } catch (e: any) {
          if (/duplicate key|unique/i.test(e?.message || '')) return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' }, count: null, status: 409 }
          throw e
        }
        out.push(row)
      } else {
        const conflict: string[] = opts.onConflict ? String(opts.onConflict).split(',').map((s) => s.trim()) : pk
        const sameAsPk = conflict.length === pk.length && conflict.every((c, i) => c === pk[i])
        if (sameAsPk) {
          const res = await prisma.$queryRawUnsafe<{ data: Row }[]>(
            `INSERT INTO "SiteRow"("tableName","rowKey","data") VALUES ($1,$2,$3::jsonb)
             ON CONFLICT ("tableName","rowKey") ${opts.ignoreDuplicates ? 'DO NOTHING' : `DO UPDATE SET "data" = "SiteRow"."data" || EXCLUDED."data", "updatedAt" = now()`} RETURNING "data"`,
            table, key, JSON.stringify(row))
          if (res[0]) out.push(res[0].data)
        } else {
          // Conflict on non-key columns: update the matching row if there is one, else insert.
          const q = new Params(); const t2 = q.add(table)
          const w = conflict.map((c) => cond(q, c, 'eq', row[c] ?? null)).map((x) => `(${x})`).join(' AND ')
          const ex = await prisma.$queryRawUnsafe<{ rowKey: string }[]>(`SELECT "rowKey" FROM "SiteRow" WHERE "tableName" = ${t2} AND ${w} LIMIT 1`, ...q.list)
          if (ex[0]) {
            if (!opts.ignoreDuplicates) {
              const { id: _drop, ...rest } = row
              const r = await prisma.$queryRawUnsafe<{ data: Row }[]>(`UPDATE "SiteRow" SET "data" = "data" || $1::jsonb, "updatedAt" = now() WHERE "tableName" = $2 AND "rowKey" = $3 RETURNING "data"`, JSON.stringify(rest), table, ex[0].rowKey)
              if (r[0]) out.push(r[0].data)
            }
          } else {
            await prisma.$executeRawUnsafe(`INSERT INTO "SiteRow"("tableName","rowKey","data") VALUES ($1,$2,$3::jsonb)`, table, key, JSON.stringify(row))
            out.push(row)
          }
        }
      }
    }
    return returning || single ? done(project(out), null) : { data: null, error: null, count: null, status: 201 }
  } catch (e: any) {
    console.error('[site-db]', table, e?.message || e)
    return fail(e)
  }
}

/** supabase.from(table)-compatible builder. Awaiting it runs the recorded calls. */
export function siteTable(table: string) {
  const calls: Call[] = []
  const chain: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') return (resolve: any, reject: any) => run(table, calls).then(resolve, reject)
      return (...a: any[]) => { calls.push({ m: prop, a }); return chain }
    },
  })
  return chain
}

/** Client with the same shape the website code expects from the old database client. */
export function siteClient(): any {
  return {
    from: (table: string) => siteTable(table),
    // No separate auth system any more: accounts are platform users.
    auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
  }
}

/** Insert or update many rows by primary key (used by the one-off import). */
export async function bulkUpsert(table: string, rows: Row[]): Promise<{ written: number; error?: string }> {
  let written = 0
  for (let i = 0; i < rows.length; i += 200) {
    const res = await run(table, [{ m: 'upsert', a: [rows.slice(i, i + 200)] }])
    if (res.error) return { written, error: res.error.message }
    written += Math.min(200, rows.length - i)
  }
  return { written }
}
