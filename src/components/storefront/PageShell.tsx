'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

/** Shared page frame for the storefront manager tools: title, optional back link, actions. */
export default function PageShell({
  title,
  description,
  backHref,
  backLabel = 'Back',
  actions,
  children,
}: {
  title: string
  description?: string
  backHref?: string
  backLabel?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '8px 4px 48px' }}>
      {backHref && (
        <Link href={backHref} style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← {backLabel}
        </Link>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, margin: '8px 0 20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h1>
          {description && <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{description}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
      </div>
      {children}
    </div>
  )
}

/** Friendly notice when the API reports STOREFRONT_NOT_CONFIGURED or any other load error. */
export function LoadNotice({ error }: { error?: { message?: string } | string | null }) {
  if (!error) return null
  const message = typeof error === 'string' ? error : error.message || 'Could not load data.'
  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
      {message}
    </div>
  )
}

/** SWR fetcher that surfaces the API's error message. */
export async function storefrontFetcher(url: string) {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}
