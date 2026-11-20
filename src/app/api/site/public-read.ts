import { NextResponse } from 'next/server'
import { isStorefrontConfigured } from '@/lib/storefront/db'

/** Public, cacheable JSON for storefront read-only endpoints. Empty fallback when not configured. */
export function publicJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: status === 200 ? { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } : { 'Cache-Control': 'no-store' },
  })
}

export function notConfigured(empty: unknown) {
  return isStorefrontConfigured() ? null : publicJson(empty)
}

export function readError(scope: string, err: unknown) {
  console.error(`[site:${scope}]`, (err as Error)?.message || err)
  return publicJson({ error: 'Failed to load' }, 500)
}
