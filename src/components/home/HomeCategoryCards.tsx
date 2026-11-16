'use client'

import Link from 'next/link'

interface Category {
  key: string
  label: string
  gradient: string
  shadow: string
  icon: React.ReactNode
  href?: string
}

const CATEGORIES: Category[] = [
  {
    key: 'qualifier',
    label: 'Qualifier Course',
    gradient: 'var(--primary)',
    shadow: 'rgba(79, 70, 229, 0.30)',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6"/>
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
      </svg>
    ),
  },
  {
    key: 'foundation',
    label: 'Foundation Course',
    gradient: 'linear-gradient(135deg, #0d9488, #10b981)',
    shadow: 'rgba(13, 148, 136, 0.30)',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18"/>
        <path d="M5 21V8l7-5 7 5v13"/>
        <path d="M9 21v-6h6v6"/>
      </svg>
    ),
  },
  {
    key: 'diploma',
    label: 'Diploma Course',
    gradient: 'linear-gradient(135deg, #f97316, #f59e0b)',
    shadow: 'rgba(245, 158, 11, 0.30)',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    ),
  },
  {
    key: 'notes',
    label: 'Notes & PYQs',
    href: '/free-resources',
    gradient: 'var(--primary)',
    shadow: 'rgba(219, 39, 119, 0.30)',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="9" y1="13" x2="15" y2="13"/>
        <line x1="9" y1="17" x2="15" y2="17"/>
      </svg>
    ),
  },
]

export default function HomeCategoryCards() {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ marginBottom: '14px', padding: '0 4px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
          Categories
        </h3>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '2px' }}>
          Find a track that fits your goal
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
      }}>
        {CATEGORIES.map(c => (
          <Link
            key={c.key}
            href={c.href ?? '/courses'}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '8px',
              textDecoration: 'none', color: 'inherit',
            }}
          >
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: c.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff',
              boxShadow: `0 10px 22px -6px ${c.shadow}, 0 4px 6px -2px rgba(15,23,42,0.04)`,
              border: '3px solid var(--border)',
              transition: 'transform 0.2s ease',
            }}>
              {c.icon}
            </div>
            <div style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)',
              textAlign: 'center', lineHeight: 1.2,
              padding: '0 2px',
            }}>
              {c.label}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
