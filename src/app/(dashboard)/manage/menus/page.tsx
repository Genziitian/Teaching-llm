'use client'

import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { MENU_REGISTRY, LOCKED_MENUS, DEFAULT_HIDDEN_MENUS } from '@/lib/menu-visibility-config'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function MenuVisibilityPage() {
  const { data: authData, isLoading } = useSWR('/api/auth/me', fetcher)
  const { data } = useSWR<{ hidden: string[] }>('/api/menu-visibility', fetcher)
  const [hidden, setHidden] = useState<string[]>(DEFAULT_HIDDEN_MENUS)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (data?.hidden) setHidden(data.hidden)
  }, [data])

  if (isLoading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
  if (authData?.user?.role !== 'MANAGER') {
    return (
      <div style={{ maxWidth: 560, margin: '48px auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Menu Visibility</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manager access required.</p>
      </div>
    )
  }

  const toggle = (href: string) =>
    setHidden(h => (h.includes(href) ? h.filter(x => x !== href) : [...h, href]))

  async function save() {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/menu-visibility', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Save failed')
      setHidden(j.hidden)
      mutate('/api/menu-visibility')
      setMsg('Saved. The sidebar updates for everyone on their next load.')
    } catch (e: any) {
      setMsg(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const groups = Array.from(new Set(MENU_REGISTRY.map(m => m.group)))

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 0 48px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Menu Visibility</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '6px 0 20px' }}>
        Turn a sidebar item off to hide it from students and staff. Managers always see every item, marked “Hidden”.
        This only hides the link; the page itself is not blocked.
      </p>

      {groups.map(g => (
        <section key={g} className="gz-panel" style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{g}</div>
          {MENU_REGISTRY.filter(m => m.group === g).map(m => {
            const visible = !hidden.includes(m.href)
            const locked = LOCKED_MENUS.includes(m.href)
            return (
              <label key={m.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: locked ? 'not-allowed' : 'pointer' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  {m.label}
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>{m.href.startsWith('http') ? 'external' : m.href}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: visible ? 'var(--text-muted)' : 'var(--text-primary)' }}>{visible ? 'Shown' : 'Hidden'}</span>
                  <input type="checkbox" role="switch" checked={visible} disabled={locked} onChange={() => toggle(m.href)} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                </span>
              </label>
            )
          })}
        </section>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        {msg && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{msg}</span>}
      </div>
    </div>
  )
}
