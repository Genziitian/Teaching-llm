// Data access for the native Follow-ups page (abandoned-checkout call list).
// Every query goes through the class server's whitelisted proxy (/api/storefront/db) via the
// storefrontDb shim, so the browser never talks to the storefront Supabase project directly.
import { supabase } from './storefrontDb'
import { DAY, FETCH_WINDOW_DAYS, type CallLog, type CallOutcome, type OrderRow, type ProfileRow } from './FollowUpsLogic'

export type FollowUpsCatalogRow = { id: string; name: string; bundleCourses?: any[]; courseIds?: string[] }

export interface FollowUpsSnapshot {
  orders: OrderRow[]
  profiles: ProfileRow[]
  calls: CallLog[]
  catalog: FollowUpsCatalogRow[]
  /** cart_followup_calls does not exist yet (schema not applied): the list still works, logging doesn't. */
  tableMissing: boolean
}

const PAGE = 1000
// Small enough that an `in (...)` read stays under the proxy's GET size limit (avoids POST rate limiting).
const CHUNK = 60
const PARALLEL = 4
const ORDER_COLS = 'order_id, user_email, course_ids, total_amount, status, created_at'

type DbRes<T> = { data: T[] | null; error: any }

/** Page through a query (PostgREST caps responses at 1000 rows). */
async function fetchAll<T>(make: (from: number, to: number) => PromiseLike<DbRes<T>>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make(from, from + PAGE - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < PAGE) return out
  }
}

/** Run an `in (...)` query over many values, a few chunks at a time. */
async function inChunks<T>(values: string[], run: (chunk: string[]) => PromiseLike<DbRes<T>>): Promise<T[]> {
  const chunks: string[][] = []
  for (let i = 0; i < values.length; i += CHUNK) chunks.push(values.slice(i, i + CHUNK))
  const out: T[] = []
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const results = await Promise.all(chunks.slice(i, i + PARALLEL).map((c) => run(c)))
    for (const { data, error } of results) {
      if (error) throw error
      out.push(...(data || []))
    }
  }
  return out
}

const isMissingTable = (err: any) => {
  const msg = String(err?.message || '')
  return err?.code === '42P01' || err?.code === 'PGRST205' || msg.includes('cart_followup_calls')
}

export async function loadFollowUps(): Promise<FollowUpsSnapshot> {
  const since = new Date(Date.now() - FETCH_WINDOW_DAYS * DAY).toISOString()

  const created = await fetchAll<OrderRow>((from, to) =>
    supabase
      .from('website_orders')
      .select(ORDER_COLS)
      .eq('status', 'CREATED')
      .not('order_id', 'like', 'AUTO_%')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, to)
  )

  const emails = Array.from(new Set(created.map((o) => o.user_email).filter(Boolean)))

  const [paid, profiles, catalogRes, coursesRes] = await Promise.all([
    // All-time purchases for these people: what they already own and whether they paid later.
    inChunks<OrderRow>(emails, (chunk) =>
      supabase.from('website_orders').select(ORDER_COLS).eq('status', 'PAID').in('user_email', chunk)
    ),
    inChunks<ProfileRow>(emails, (chunk) => supabase.from('profiles').select('email, name, phone').in('email', chunk)),
    supabase.from('course_catalog').select('id, name'),
    supabase.from('courses').select('id, name, bundleCourses, courseIds'),
  ])

  let calls: CallLog[] = []
  let tableMissing = false
  try {
    calls = await fetchAll<CallLog>((from, to) =>
      supabase.from('cart_followup_calls').select('*').gte('created_at', since).order('created_at').range(from, to)
    )
  } catch (err: any) {
    if (isMissingTable(err)) tableMissing = true
    else throw err
  }

  return {
    orders: [...created, ...paid],
    profiles,
    calls,
    catalog: [...((catalogRes as any)?.data || []), ...((coursesRes as any)?.data || [])] as FollowUpsCatalogRow[],
    tableMissing,
  }
}

export async function insertFollowUpCall(row: {
  lead_key: string
  user_email: string
  outcome: CallOutcome
  note: string | null
  callback_at: string | null
  called_by: string | null
}): Promise<CallLog> {
  const { data, error } = await supabase.from('cart_followup_calls').insert(row).select('*').single()
  if (error) throw new Error(error.message || 'Could not save the call')
  if (!data) throw new Error('Could not save the call')
  return data as CallLog
}

export async function deleteFollowUpCall(id: string): Promise<void> {
  const { error } = await supabase.from('cart_followup_calls').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Could not remove the entry')
}

/** Display name for a course id, using bundle entries, catalog overrides and parent bundles. */
export function makeCourseNamer(catalog: FollowUpsCatalogRow[]) {
  return (cid: string): string => {
    for (const c of catalog) {
      if (Array.isArray(c.bundleCourses)) {
        const bc = c.bundleCourses.find((b: any) => b?.courseId === cid || b?.courseId2 === cid || b?.courseId3 === cid || b?.id === cid)
        if (bc?.courseName) return bc.courseName as string
      }
    }
    const direct = catalog.find((c) => c.id === cid)
    if (direct?.name) return direct.name
    const parent = catalog.find((c) => Array.isArray(c.courseIds) && c.courseIds.includes(cid))
    if (parent?.name) return parent.name
    return cid.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
  }
}
