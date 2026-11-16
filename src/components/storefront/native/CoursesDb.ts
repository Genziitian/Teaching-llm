// Tiny client for /api/storefront/db (same protocol as storefront-panel/src/lib/supabase.ts).
type Call = { m: string; a: any[] }
export type DbResult = { data: any; error: { message: string; code?: string } | null }

function b64url(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sfDb(table: string, calls: Call[]): Promise<DbResult> {
  const isRead = calls[0]?.m === 'select' && !calls.some(c => ['insert', 'update', 'upsert', 'delete'].includes(c.m))
  try {
    let res: Response | null = null
    if (isRead) {
      const q = b64url(JSON.stringify({ table, calls }))
      if (q.length <= 6000) res = await fetch(`/api/storefront/db?q=${q}`, { credentials: 'same-origin' })
    }
    if (!res) {
      res = await fetch('/api/storefront/db', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ table, calls }),
      })
    }
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      const message = (body && (typeof body.error === 'string' ? body.error : body.error?.message)) || `Request failed (${res.status})`
      return { data: null, error: { message, code: body?.code } }
    }
    return { data: body?.data ?? null, error: body?.error ?? null }
  } catch (e: any) {
    return { data: null, error: { message: e?.message || 'Network error' } }
  }
}

export type CourseTerm = 'Re-attempt' | 'Foundation' | 'DIPLOMA' | 'Qualifier'
export const TERM_OPTIONS: CourseTerm[] = ['Qualifier', 'Re-attempt', 'Foundation', 'DIPLOMA']
export const DEFAULT_BOX_CONFIG: Record<CourseTerm, string[]> = {
  Qualifier: ['Qualifier'],
  'Re-attempt': ['Re-attempt'],
  Foundation: ['Quiz 1', 'Quiz 2', 'End Term', 'Full Term'],
  DIPLOMA: ['Quiz 1', 'Quiz 2', 'End Term', 'Full Term'],
}

export async function loadBoxConfig(): Promise<{ config: Record<CourseTerm, string[]>; error: string | null }> {
  const { data, error } = await sfDb('settings', [
    { m: 'select', a: ['*'] },
    { m: 'eq', a: ['key', 'exam_visibility'] },
    { m: 'maybeSingle', a: [] },
  ])
  if (error) return { config: DEFAULT_BOX_CONFIG, error: error.message }
  try {
    if (data?.value) return { config: { ...DEFAULT_BOX_CONFIG, ...JSON.parse(data.value) }, error: null }
  } catch { /* fall through */ }
  return { config: DEFAULT_BOX_CONFIG, error: null }
}

export function sanitizeCourseId(value: string) {
  if (!value || typeof value !== 'string') return ''
  return value.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
}
