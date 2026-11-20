'use client'

import { useCallback, useEffect, useState } from 'react'

export default function SiteDataPage() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [tables, setTables] = useState<string[]>([])
  const [legacy, setLegacy] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/manage/site-data/import', { cache: 'no-store' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setError(d.error || 'Could not load'); return }
    setTables(d.tables); setCounts(d.counts); setLegacy(!!d.legacyConnected)
  }, [])
  useEffect(() => { void load() }, [load])

  const importAll = async () => {
    if (!window.confirm('Copy all website data from the old database into the platform database? Existing rows with the same ID are updated. Safe to run again.')) return
    setBusy(true); setError(''); setLog([])
    for (const table of tables) {
      let offset = 0, total = 0
      for (;;) {
        const r = await fetch('/api/manage/site-data/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table, offset }) })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) { setError(`${table}: ${d.error || 'failed'}`); setBusy(false); void load(); return }
        total += d.imported
        if (d.next == null) break
        offset = d.next
      }
      setLog(l => [...l, `${table}: ${total} rows`])
    }
    setBusy(false)
    void load()
  }

  return (
    <div style={{ width: '100%', display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={importAll} disabled={busy || !legacy}>{busy ? 'Importing…' : 'Import from old website database'}</button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {legacy ? 'Old database connected.' : 'Old database not connected: set STOREFRONT_SUPABASE_URL and STOREFRONT_SUPABASE_SERVICE_ROLE_KEY to import.'}
        </span>
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
      <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, overflow: 'hidden' }}>
        {tables.map(t => (
          <div key={t} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
            <span style={{ color: 'var(--text-primary)' }}>{t}</span>
            <span style={{ color: 'var(--text-muted)' }}>{counts[t] ?? 0} rows</span>
          </div>
        ))}
      </div>
      {log.length > 0 && <pre style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{log.join('\n')}</pre>}
    </div>
  )
}
