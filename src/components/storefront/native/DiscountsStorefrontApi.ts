// Tiny client for the class server's storefront DB proxy (/api/storefront/db).
export type SfResult<T = any> = { data: T | null; error: { message: string } | null }

type Call = { m: string; a: unknown[] }

export async function sfWrite(table: string, calls: Call[]): Promise<SfResult> {
  try {
    const res = await fetch('/api/storefront/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, calls }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return { data: null, error: { message: j?.error || `Request failed (${res.status})` } }
    return { data: j.data ?? null, error: j.error || null }
  } catch (e: any) {
    return { data: null, error: { message: e?.message || 'Network error' } }
  }
}

export async function sfManagerFetch<T = any>(params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`/api/storefront/manager-fetch?${qs}`)
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error || `Request failed (${res.status})`)
  return j as T
}
