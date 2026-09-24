'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { FACT_RARITY_LABELS, normalizeFactRarity } from '@/lib/facts/loading-fact-rarity'
import { LoadingFactRarity } from '@/lib/facts/loading-facts-data'
import { refreshRuntimeLoadingFacts } from '@/components/LoadingFactsHydrator'

type ManagedFact = {
  id: string
  text: string
  rarity: LoadingFactRarity
  isCoupon: boolean
  isActive: boolean
  createdAt: string
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

const rarityColors: Record<LoadingFactRarity, { bg: string; color: string; border: string }> = {
  COMMON: { bg: 'var(--surface-2)', color: 'var(--text-secondary)', border: 'var(--border)' },
  RARE: { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', border: 'rgba(99,102,241,0.35)' },
  ULTRA_RARE: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.35)' },
}

export default function LoadingFactsAdminPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ManagedFact | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [form, setForm] = useState({ text: '', rarity: 'COMMON' as LoadingFactRarity, isCoupon: false, isActive: true })
  const [bulkText, setBulkText] = useState('')
  const [bulkRarity, setBulkRarity] = useState<LoadingFactRarity>('COMMON')
  const [bulkCoupon, setBulkCoupon] = useState(false)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('q', debouncedSearch)
    if (rarityFilter) params.set('rarity', rarityFilter)
    params.set('page', String(page))
    params.set('limit', '50')
    return `/api/manage/facts?${params.toString()}`
  }, [debouncedSearch, rarityFilter, page])

  const { data, error, isLoading, mutate } = useSWR(query, fetcher, { revalidateOnFocus: false })
  const facts: ManagedFact[] = data?.facts || []
  const total = data?.total || 0
  const counts = data?.counts || { all: 0, COMMON: 0, RARE: 0, ULTRA_RARE: 0 }
  const warning = typeof data?.warning === 'string' ? data.warning : ''
  const totalPages = Math.max(1, Math.ceil(total / 50))

  const applySearch = () => {
    setPage(1)
    setDebouncedSearch(search.trim())
  }

  const resetForm = () => {
    setForm({ text: '', rarity: 'COMMON', isCoupon: false, isActive: true })
    setEditing(null)
  }

  const afterChange = async () => {
    await mutate()
    await refreshRuntimeLoadingFacts()
  }

  const handleSave = async () => {
    if (!form.text.trim()) { alert('Fact text is required'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/manage/facts/${editing.id}` : '/api/manage/facts'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to save fact')
        return
      }
      resetForm()
      setShowAdd(false)
      await afterChange()
    } catch {
      alert('Failed to save fact')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) { alert('Paste at least one fact'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/manage/facts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bulkText, rarity: bulkRarity, isCoupon: bulkCoupon }),
      })
      const result = await res.json()
      if (!res.ok) {
        alert(result.error || 'Failed to bulk add')
        return
      }
      setBulkText('')
      setShowBulk(false)
      setPage(1)
      await afterChange()
      alert(`Added ${result.created} fact${result.created === 1 ? '' : 's'}${result.skipped ? `, skipped ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'}` : ''}`)
    } catch {
      alert('Failed to bulk add facts')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (fact: ManagedFact) => {
    const allowed = await confirm({
      title: 'Delete fact',
      message: 'This fact will no longer appear on loading screens.',
      confirmLabel: 'Delete Fact',
      tone: 'danger',
      entityType: 'Fact',
      entityName: fact.text.slice(0, 60),
    })
    if (!allowed) return
    const res = await fetch(`/api/manage/facts/${fact.id}`, { method: 'DELETE' })
    if (res.ok) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(fact.id)
        return next
      })
      await afterChange()
    } else {
      alert('Failed to delete fact')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    const allowed = await confirm({
      title: 'Delete selected facts',
      message: `Permanently delete ${selectedIds.size} selected fact${selectedIds.size === 1 ? '' : 's'}?`,
      confirmLabel: 'Delete Selected',
      tone: 'danger',
    })
    if (!allowed) return
    const res = await fetch('/api/manage/facts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    })
    if (res.ok) {
      setSelectedIds(new Set())
      await afterChange()
    } else {
      alert('Failed to delete selected facts')
    }
  }

  const startEdit = (fact: ManagedFact) => {
    setEditing(fact)
    setForm({
      text: fact.text,
      rarity: normalizeFactRarity(fact.rarity),
      isCoupon: !!fact.isCoupon,
      isActive: fact.isActive !== false,
    })
    setShowAdd(true)
    setShowBulk(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allVisibleSelected = facts.length > 0 && facts.every(f => selectedIds.has(f.id))

  const chip = (label: string, value: string, count?: number) => {
    const active = rarityFilter === value
    return (
      <button
        key={value || 'all'}
        type="button"
        onClick={() => { setRarityFilter(value); setPage(1) }}
        style={{
          padding: '7px 12px',
          borderRadius: '999px',
          border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
          background: active ? 'var(--primary-light)' : 'var(--surface)',
          color: active ? 'var(--primary)' : 'var(--text-secondary)',
          fontWeight: 700,
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        {label}{typeof count === 'number' ? ` (${count})` : ''}
      </button>
    )
  }

  return (
    <div className="dashboard-inner-page" style={{ padding: '24px 32px' }}>
      {confirmDialog}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {chip('All', '', counts.all)}
          {chip('Common', 'COMMON', counts.COMMON)}
          {chip('Rare', 'RARE', counts.RARE)}
          {chip('Super Rare', 'ULTRA_RARE', counts.ULTRA_RARE)}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { setShowBulk(v => !v); setShowAdd(false); resetForm() }}
            className="btn btn-ghost"
          >
            {showBulk ? 'Close Bulk Add' : 'Bulk Add'}
          </button>
          <button
            type="button"
            onClick={() => { resetForm(); setShowAdd(true); setShowBulk(false) }}
            className="btn btn-primary"
          >
            + Add Fact
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          className="form-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applySearch() }}
          placeholder="Search facts..."
          style={{ flex: 1, minWidth: '220px' }}
        />
        <button type="button" className="btn btn-primary" onClick={applySearch}>Search</button>
        {(debouncedSearch || rarityFilter) && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { setSearch(''); setDebouncedSearch(''); setRarityFilter(''); setPage(1) }}
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.35)',
          color: 'var(--danger)',
          fontSize: '13px',
          fontWeight: 700,
        }}>
          Could not load facts. Refresh the page to try again.
        </div>
      )}

      {warning && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.35)',
          color: '#f59e0b',
          fontSize: '13px',
          fontWeight: 700,
        }}>
          {warning}
        </div>
      )}

      {showAdd && (
        <div className="card" style={{ padding: '20px', marginBottom: '18px', borderTop: '4px solid var(--primary)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '14px' }}>{editing ? 'Edit Fact' : 'Add Fact'}</h2>
          <textarea
            className="form-input"
            rows={4}
            value={form.text}
            onChange={e => setForm(prev => ({ ...prev, text: e.target.value }))}
            placeholder='e.g. Fact : "Ye question exam mein thodi aayega." Famous last words.'
          />
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: 700 }}>
              Rarity
              <select
                className="form-input"
                value={form.rarity}
                onChange={e => setForm(prev => ({ ...prev, rarity: normalizeFactRarity(e.target.value) }))}
                style={{ marginTop: '6px', minWidth: '160px' }}
              >
                <option value="COMMON">Common</option>
                <option value="RARE">Rare</option>
                <option value="ULTRA_RARE">Super Rare</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, marginTop: '18px' }}>
              <input type="checkbox" checked={form.isCoupon} onChange={e => setForm(prev => ({ ...prev, isCoupon: e.target.checked }))} />
              Coupon fact
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, marginTop: '18px' }}>
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))} />
              Active
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button type="button" className="btn btn-ghost" onClick={() => { setShowAdd(false); resetForm() }}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving...' : editing ? 'Update Fact' : 'Save Fact'}
            </button>
          </div>
        </div>
      )}

      {showBulk && (
        <div className="card" style={{ padding: '20px', marginBottom: '18px', borderTop: '4px solid #f59e0b' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '8px' }}>Bulk Add Facts</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            One fact per line. Prefix a line with <code>[RARE]</code> or <code>[SUPER RARE]</code> to override the default rarity.
          </p>
          <textarea
            className="form-input"
            rows={10}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder={'Quiz ke 1 din pehle padhai start.\n[RARE] Famous last words: ye easy paper hoga.\n[SUPER RARE] Ultra rare drop just dropped.'}
          />
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: 700 }}>
              Default rarity
              <select
                className="form-input"
                value={bulkRarity}
                onChange={e => setBulkRarity(normalizeFactRarity(e.target.value))}
                style={{ marginTop: '6px', minWidth: '160px' }}
              >
                <option value="COMMON">Common</option>
                <option value="RARE">Rare</option>
                <option value="ULTRA_RARE">Super Rare</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, marginTop: '18px' }}>
              <input type="checkbox" checked={bulkCoupon} onChange={e => setBulkCoupon(e.target.checked)} />
              Mark as coupon facts
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowBulk(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={handleBulkAdd}>
              {saving ? 'Adding...' : 'Add All'}
            </button>
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          marginBottom: '12px',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--danger)' }}>
            {selectedIds.size} selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setSelectedIds(new Set())}>Clear</button>
            <button type="button" className="btn" onClick={handleBulkDelete} style={{ background: 'var(--danger)', color: '#fff' }}>
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading facts...</div>
      ) : facts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'var(--surface)', borderRadius: '20px', border: '2px dashed var(--border)' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>💡</div>
          <p style={{ fontSize: '16px', fontWeight: 700 }}>No facts found</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Add one, bulk paste, or clear your search.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={() => {
                if (allVisibleSelected) {
                  setSelectedIds(prev => {
                    const next = new Set(prev)
                    facts.forEach(f => next.delete(f.id))
                    return next
                  })
                } else {
                  setSelectedIds(prev => {
                    const next = new Set(prev)
                    facts.forEach(f => next.add(f.id))
                    return next
                  })
                }
              }}
            />
            Select page ({facts.length})
          </label>
          {facts.map(fact => {
            const rarity = normalizeFactRarity(fact.rarity)
            const colors = rarityColors[rarity]
            return (
              <div
                key={fact.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '14px 16px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  opacity: fact.isActive === false ? 0.55 : 1,
                }}
              >
                <input type="checkbox" checked={selectedIds.has(fact.id)} onChange={() => toggleSelect(fact.id)} style={{ marginTop: '4px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: '999px',
                      background: colors.bg,
                      color: colors.color,
                      border: `1px solid ${colors.border}`,
                    }}>
                      {FACT_RARITY_LABELS[rarity]}
                    </span>
                    {fact.isCoupon && (
                      <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', color: '#34d399' }}>
                        Coupon
                      </span>
                    )}
                    {fact.isActive === false && (
                      <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '999px', background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                        Hidden
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, whiteSpace: 'pre-line', color: 'var(--text-primary)' }}>{fact.text}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => startEdit(fact)}>Edit</button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleDelete(fact)} style={{ color: 'var(--danger)' }}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
          <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>Page {page} of {totalPages} · {total} facts</span>
          <button type="button" className="btn btn-ghost" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
        </div>
      )}
    </div>
  )
}
