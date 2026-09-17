'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function SupportFloatingButton() {
  const pathname = usePathname()
  const [isNativeApp, setIsNativeApp] = useState<boolean | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(null)
  const { data } = useSWR('/api/auth/me', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })
  const userRole = data?.user?.role || data?.role || ''
  
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const nativeFromWindow = !!(
        document.documentElement.classList.contains('is-native') ||
        (window as any).Capacitor?.isNativePlatform?.() ||
        (window as any).Capacitor?.isNative
      )

      if (nativeFromWindow) {
        if (mounted) setIsNativeApp(true)
        return
      }

      try {
        const { Capacitor } = await import('@capacitor/core')
        if (mounted) setIsNativeApp(Capacitor.isNativePlatform())
      } catch {
        if (mounted) setIsNativeApp(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const updateIsMobile = () => setIsMobileViewport(query.matches)

    updateIsMobile()
    if (query.addEventListener) {
      query.addEventListener('change', updateIsMobile)
      return () => query.removeEventListener('change', updateIsMobile)
    }

    query.addListener(updateIsMobile)
    return () => query.removeListener(updateIsMobile)
  }, [])

  // Visibility Rules:
  // Hide on: Profile, Settings, Exam pages, Lecture pages (recordings), Support tab, Community section,
  // Courses, Calendar, Study Materials, and taking exam
  const hiddenPaths = [
    '/profile',
    '/settings',
    '/materials/recordings',
    '/support',
    '/community',
    '/calendar',
    '/materials',
    '/courses',
    '/live'
  ]

  const isHidden = hiddenPaths.some(path => pathname === path || pathname.startsWith(path + '/'))

  if (
    isNativeApp !== false ||
    isMobileViewport !== false ||
    isHidden ||
    userRole === 'MANAGER' ||
    userRole === 'ADMIN'
  ) return null

  return (
    <div
      className="support-floating-wrapper"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '10px',
      }}
    >
      {/* Option Stack */}
      <div
        className={`support-stack ${isHovered ? 'active' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
          opacity: isHovered ? 1 : 0,
          transform: isHovered ? 'translateY(0)' : 'translateY(15px) scale(0.95)',
          pointerEvents: isHovered ? 'auto' : 'none',
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Option 1: Raise Ticket */}
        <Link
          href="/support?openTicket=true"
          className="support-stack-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '30px',
            background: 'var(--sidebar-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: '700',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5v2"/>
            <path d="M15 11v2"/>
            <path d="M15 17v2"/>
            <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z"/>
          </svg>
          Raise Ticket
        </Link>

        {/* Option 2: Mail Us */}
        <a
          href="mailto:admin@genziitian.org"
          className="support-stack-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '30px',
            background: 'var(--sidebar-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: '700',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Mail Us
        </a>

        {/* Option 3: More */}
        <Link
          href="/support"
          className="support-stack-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '30px',
            background: 'var(--sidebar-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: '700',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4"/>
            <path d="M12 8h.01"/>
          </svg>
          More
        </Link>
      </div>

      {/* Main Trigger Button */}
      <div
        onClick={() => setIsHovered(!isHovered)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 20px',
          borderRadius: '50px',
          background: 'linear-gradient(135deg, #3636e8 0%, #5b5bf0 100%)',
          color: '#ffffff',
          fontWeight: '700',
          fontSize: '14px',
          boxShadow: '0 8px 16px rgba(54,54,232,0.3)',
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          cursor: 'pointer',
          transform: isHovered ? 'scale(1.03)' : 'scale(1)',
        }}
        className="support-btn-float"
      >
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.3s ease',
          transform: isHovered ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          {isHovered ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          )}
        </div>
        {isHovered ? 'Close' : 'Need Help?'}
      </div>

      <style jsx>{`
        .support-stack-item:hover {
          transform: translateY(-2px);
          background: var(--surface) !important;
          border-color: var(--primary) !important;
          box-shadow: 0 6px 16px rgba(54,54,232,0.15) !important;
        }
        .support-stack-item:active {
          transform: translateY(0);
        }
        .support-btn-float:hover {
          box-shadow: 0 12px 24px rgba(54,54,232,0.4) !important;
        }
        .support-btn-float:active {
          transform: scale(0.97) !important;
        }
      `}</style>
    </div>
  )
}
