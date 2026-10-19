'use client'

import useSWR from 'swr'
import Link from 'next/link'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function PurchasedMaterialsPage() {
  const { data, error, isLoading } = useSWR('/api/free-resources/purchased', fetcher)
  const materials = data?.materials || []

  return (
    <div className="page-container fade-in">
      <div style={{ marginBottom: '32px' }}>
        <Link href="/free-resources" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to Free Resources
        </Link>
        <h1 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>Purchased Materials</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginTop: '8px' }}>Access your purchased study notes. Each note stays available until its expiry date shown below.</p>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '200px', background: 'var(--surface)', borderRadius: '24px', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : materials.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {materials.map((m: any) => {
            const daysLeft = Math.ceil((new Date(m.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            return (
              <div key={m.id} style={{ background: 'var(--surface)', borderRadius: '24px', padding: '24px', boxShadow: '0 10px 30px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>{m.title}</h3>
                    <div style={{ fontSize: '13px', marginTop: '2px', fontWeight: '600', color: daysLeft <= 5 ? 'var(--danger)' : 'var(--success)' }}>{daysLeft} days left</div>
                  </div>
                </div>
                {m.description && <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>{m.description}</p>}
                
                <div style={{ marginTop: 'auto' }}>
                  {(m.files?.length || 0) > 1 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {m.files.map((f: any) => (
                        <button key={f.id} onClick={() => window.open(`/api/store/notes/${m.noteId}/download?fileId=${f.id}`, '_blank')} style={{ width: '100%', padding: '12px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.title || 'Open file'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button onClick={() => window.open(`/api/store/notes/${m.noteId}/download`, '_blank')} style={{ width: '100%', padding: '12px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s' }}>
                      Access Material
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--surface)', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--text-muted)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>No Purchased Materials</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>You haven't purchased any study materials yet. Visit the Store to explore available notes and resources.</p>
          <Link href="/courses/explore" style={{ display: 'inline-block', marginTop: '24px', padding: '10px 20px', background: 'var(--info)', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: '600' }}>Explore Store</Link>
        </div>
      )}
    </div>
  )
}
