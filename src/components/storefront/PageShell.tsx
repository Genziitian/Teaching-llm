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
  // The dashboard header already names the page, so only the actions are shown here.
  return (
    <div style={{ width: '100%', padding: '8px 0 48px' }}>
      {actions && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, margin: '0 0 16px', flexWrap: 'wrap' }}>{actions}</div>
      )}
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
