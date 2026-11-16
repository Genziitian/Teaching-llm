'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { isCapacitorNative } from '@/lib/capacitor-push'

interface Section {
  href: string
  title: string
  subtitle: string
  icon: React.ReactNode
  gradient: string
  shadow: string
  appGradient: string
  appShadow: string
}

const SECTIONS: Section[] = [
  {
    href: '/calendar',
    title: 'Calendar',
    subtitle: 'Schedule, classes & deadlines',
    gradient: 'var(--primary)',
    shadow: 'rgba(79, 70, 229, 0.25)',
    appGradient: 'linear-gradient(135deg, #b58bfd, #703bf7)',
    appShadow: 'rgba(112, 59, 247, 0.35)',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/live',
    title: 'Live Sessions',
    subtitle: 'Join live classes & recordings',
    gradient: 'linear-gradient(135deg, #ef4444, #f97316)',
    shadow: 'rgba(239, 68, 68, 0.25)',
    appGradient: 'linear-gradient(135deg, #ff5c4d, #ff9575)',
    appShadow: 'rgba(255, 92, 77, 0.35)',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
  },
  {
    href: '/free-resources',
    title: 'Free Resources',
    subtitle: 'Notes, materials & study aids',
    gradient: 'linear-gradient(135deg, #0d9488, #10b981)',
    shadow: 'rgba(13, 148, 136, 0.25)',
    appGradient: 'linear-gradient(135deg, #32e3a8, #009688)',
    appShadow: 'rgba(0, 150, 136, 0.35)',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    ),
  },
  {
    href: '/community',
    title: 'Community',
    subtitle: 'Chat with peers & instructors',
    gradient: 'var(--primary)',
    shadow: 'rgba(219, 39, 119, 0.25)',
    appGradient: 'var(--primary)',
    appShadow: 'rgba(244, 63, 94, 0.35)',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/feedback',
    title: 'Feedback',
    subtitle: 'Ratings & student reviews',
    gradient: 'linear-gradient(135deg, #f59e0b, #eab308)',
    shadow: 'rgba(245, 158, 11, 0.25)',
    appGradient: 'linear-gradient(135deg, #ffd000, #ff9100)',
    appShadow: 'rgba(255, 145, 0, 0.35)',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    href: '/announcements',
    title: 'Announcements',
    subtitle: 'Latest news & updates',
    gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    shadow: 'rgba(59, 130, 246, 0.25)',
    appGradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    appShadow: 'rgba(29, 78, 216, 0.35)',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
]

const ChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9999b0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

export default function AcademicsPage() {
  const [isCapacitor, setIsCapacitor] = useState<boolean>(false)
  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const check = () => {
      const hasClass = document.documentElement.classList.contains('is-native')
      const hasWindow = !!(window as any).Capacitor?.isNativePlatform?.()
      if (hasClass || hasWindow) {
        setIsCapacitor(true)
        return true
      }
      return false
    }

    if (check()) return

    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) {
        setIsCapacitor(true)
      }
    }).catch(() => {})

    const intervalId = setInterval(() => {
      if (check()) {
        clearInterval(intervalId)
      }
    }, 100)

    const timeoutId = setTimeout(() => {
      clearInterval(intervalId)
    }, 2000)

    return () => {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
    }
  }, [])

  if (isCapacitor || isMobile) {
    return (
      <div className="page-container fade-in" style={{ paddingBottom: '24px' }}>
        <style dangerouslySetInnerHTML={{__html: `
          .academic-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
            padding: 8px 4px;
            margin-top: 14px;
          }
          .academic-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 22px 12px;
            border-radius: 20px;
            background: color-mix(in srgb, var(--surface) 82%, var(--surface-2) 18%);
            box-shadow: 0 8px 22px rgba(15, 23, 42, 0.055), 0 2px 7px rgba(15, 23, 42, 0.035);
            text-decoration: none;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
          }
          .academic-card:active {
            transform: scale(0.96);
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.045);
          }
          :root[data-theme="dark"] .academic-card {
            background: color-mix(in srgb, var(--surface) 62%, var(--surface-2) 38%);
            box-shadow: var(--shadow-md);
            border-color: color-mix(in srgb, var(--border) 86%, transparent);
          }
          .academic-card-icon-wrap {
            width: 68px;
            height: 68px;
            border-radius: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--bg);
            margin-bottom: 14px;
            flex-shrink: 0;
          }
          :root[data-theme="dark"] .academic-card-icon-wrap {
            color: var(--text-primary);
          }
          .academic-card-title {
            font-size: 14.5px;
            font-weight: 700;
            color: var(--text-primary);
            text-align: center;
            line-height: 1.25;
            letter-spacing: -0.01em;
            padding: 0 4px;
          }
          .mobile-page-divider {
            height: 1px;
            width: 100%;
            background: color-mix(in srgb, var(--border) 78%, transparent);
          }
        `}} />

        <div style={{
          marginTop: '12px',
          marginBottom: '20px',
          padding: '0 4px',
        }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 600, 
            color: 'var(--text-primary)', 
            margin: 0, 
            letterSpacing: '-0.03em'
          }}>
            Academics
          </h1>
          <p style={{ 
            fontSize: '14px', 
            color: 'var(--text-muted)', 
            fontWeight: 600, 
            marginTop: '4px',
            letterSpacing: '-0.01em'
          }}>
            Everything for your learning journey
          </p>
        </div>
        <div className="mobile-page-divider" />

        <div className="academic-grid">
          {SECTIONS.map(s => (
            <Link key={s.href} href={s.href} className="academic-card">
              <div 
                className="academic-card-icon-wrap" 
                style={{ 
                  background: s.appGradient,
                  boxShadow: `0 8px 20px ${s.appShadow}`
                }}
              >
                {s.icon}
              </div>
              <div className="academic-card-title">
                {s.title}
              </div>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-container fade-in" style={{ paddingBottom: '24px' }}>
      <div style={{
        marginBottom: '18px',
        padding: '4px 4px',
      }}>
        <h1 style={{ fontSize: 'clamp(20px, 5.5vw, 26px)', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
          Academics
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '4px' }}>
          Everything for your learning journey
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {SECTIONS.map(s => (
          <Link
            key={s.href}
            href={s.href}
            style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '18px 18px',
              borderRadius: '14px',
              background: 'var(--surface)',
              boxShadow: '6px 6px 16px var(--neu-dark), -6px -6px 14px var(--neu-light)',
              textDecoration: 'none', color: 'var(--text-primary)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <div style={{
              width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0,
              background: s.gradient, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 18px ${s.shadow}`,
            }}>
              {s.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>
                {s.title}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.subtitle}
              </div>
            </div>
            <ChevronRight />
          </Link>
        ))}
      </div>
    </div>
  )
}
