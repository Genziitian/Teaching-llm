'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function FreeResourcesPage() {
  const router = useRouter()
  const { data: courses } = useSWR<any[]>('/api/free-resources/courses', fetcher)
  const { data: materials } = useSWR<any[]>('/api/free-resources/materials', fetcher)

  const freeCoursesCount = courses?.length ?? 0
  const freeMaterialsCount = materials?.length ?? 0

  const cards = [
    {
      href: '/free-resources/courses',
      banner: '/images/free-courses-banner.webp',
      title: 'Free Courses',
      description: 'Browse and enroll for free.',
      count: freeCoursesCount,
      countLabel: 'courses available',
      color: 'var(--accent)',
      gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      ),
    },
    {
      href: '/free-resources/materials',
      banner: '/images/free-materials-banner.webp',
      title: 'Free Materials',
      description: 'Notes, summaries and formula sheets.',
      count: freeMaterialsCount,
      countLabel: 'materials available',
      color: 'var(--success)',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      ),
    },
    {
      href: '/free-resources/purchased',
      title: 'Purchased Materials',
      description: 'Unlocked through your courses.',
      count: '30-day',
      countLabel: 'access expiry',
      color: 'var(--warning)',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="page-container fade-in">
      <style>{`
        .free-banner { border-radius: 28px; box-shadow: 0 1px 2px rgba(16,24,40,.06), 0 10px 30px rgba(16,24,40,.10); transition: transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s; -webkit-tap-highlight-color: transparent; }
        .free-banner:active { transform: scale(.985); }
        @media (hover: hover) { .free-banner:hover { transform: translateY(-3px); box-shadow: 0 2px 4px rgba(16,24,40,.06), 0 16px 40px rgba(16,24,40,.14); } }
        @media (prefers-reduced-motion: reduce) { .free-banner, .free-banner:hover, .free-banner:active { transition: none; transform: none; } }
        @media (max-width: 768px) {
          .free-resources-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
          .free-resources-grid .free-res-card {
            padding: 18px 12px !important;
            min-height: 180px !important;
            border-radius: 20px !important;
            gap: 12px !important;
          }
          .free-resources-grid .free-res-icon {
            width: 52px !important;
            height: 52px !important;
            border-radius: 16px !important;
            margin-bottom: 0 !important;
          }
          .free-resources-grid .free-res-icon svg {
            width: 22px !important;
            height: 22px !important;
          }
          .free-resources-grid .free-res-title {
            font-size: 15px !important;
          }
          .free-resources-grid .free-res-desc {
            font-size: 11.5px !important;
            max-width: 100% !important;
          }
          .free-resources-grid .free-res-explore {
            font-size: 11px !important;
          }
          
          /* Horizontal Rectangle layout for the 3rd card on mobile */
          .free-resources-grid > a:nth-child(3) {
            grid-column: span 2 !important;
          }
          .free-resources-grid > a:nth-child(3) .free-res-card {
            display: grid !important;
            grid-template-columns: auto 1fr !important;
            grid-template-rows: auto auto !important;
            text-align: left !important;
            align-items: center !important;
            padding: 16px 14px !important;
            min-height: auto !important;
            gap: 12px 12px !important;
          }
          .free-resources-grid > a:nth-child(3) .free-res-icon {
            grid-column: 1 !important;
            grid-row: 1 !important;
          }
          .free-resources-grid > a:nth-child(3) .free-res-content {
            grid-column: 2 !important;
            grid-row: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 4px !important;
            text-align: left !important;
          }
          .free-resources-grid > a:nth-child(3) .free-res-footer {
            grid-column: 1 / span 2 !important;
            grid-row: 2 !important;
            display: flex !important;
            flex-direction: row !important;
            justify-content: flex-end !important;
            align-items: center !important;
            width: 100% !important;
            margin-top: 4px !important;
            gap: 8px !important;
          }
        }
        @media (min-width: 768px) {
          .page-header {
            display: none !important;
          }
        }
      `}</style>

      {/* Premium Neumorphic Page Header */}
      <div className="page-header" style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '32px',
        justifyContent: 'flex-start'
      }}>
        <button
          onClick={() => router.back()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'var(--surface-2)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
            color: 'var(--text-secondary)',
            transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)'
            ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
            ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <h1 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Free Resources</h1>
      </div>

      <div className="free-resources-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', width: '100%' }}>
        {cards.map((card, idx) => (card as any).banner ? (
          <Link key={card.href} href={card.href} className="free-banner" style={{ gridColumn: '1 / -1', display: 'block', textDecoration: 'none' }} aria-label={`${card.title}. ${card.description}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={(card as any).banner}
              alt=""
              width={1200}
              height={400}
              loading={idx === 0 ? 'eager' : 'lazy'}
              decoding="async"
              style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '3 / 1', borderRadius: 28, objectFit: 'cover' }}
            />
          </Link>
        ) : (
          <Link key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
            <div className="card free-res-card" style={{
              padding: '32px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '20px',
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              minHeight: '280px',
              borderRadius: '32px',
              position: 'relative',
              overflow: 'hidden'
            }}
              onMouseEnter={e => { 
                e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)' 
                e.currentTarget.style.boxShadow = '20px 20px 40px var(--neu-dark), -20px -20px 40px var(--neu-light)'
              }}
              onMouseLeave={e => { 
                e.currentTarget.style.transform = 'translateY(0) scale(1)' 
                e.currentTarget.style.boxShadow = '10px 10px 20px var(--neu-dark), -10px -10px 20px var(--neu-light)'
              }}
            >
              {/* Icon Section */}
              <div className="free-res-icon" style={{
                width: '80px', height: '80px', borderRadius: '24px',
                background: card.gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0,
                boxShadow: `0 10px 25px ${card.color}40`,
                marginBottom: '4px'
              }}>
                {card.icon}
              </div>

              {/* Text Content */}
              <div className="free-res-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h2 className="free-res-title" style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
                  {card.title}
                </h2>
                <p className="free-res-desc" style={{ 
                  fontSize: '14.5px', 
                  color: 'var(--text-secondary)', 
                  margin: 0, 
                  lineHeight: '1.5',
                  maxWidth: '240px' 
                }}>
                  {card.description}
                </p>
              </div>

              {/* Status Badge */}
              <div className="free-res-footer" style={{ 
                marginTop: 'auto', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div className="free-res-explore" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  color: card.color, 
                  fontSize: '13px', 
                  fontWeight: '700' 
                }}>
                  Explore Now
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
