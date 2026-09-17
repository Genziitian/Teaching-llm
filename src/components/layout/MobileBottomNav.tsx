'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Tab {
  href: string
  label: string
  match: (path: string) => boolean
  icon: React.ReactNode
  hideForRoles?: string[]
}

const TABS: Tab[] = [
  {
    href: '/dashboard',
    label: 'Home',
    match: p => p === '/dashboard',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/courses',
    label: 'Courses',
    match: p => p === '/courses' || (p.startsWith('/courses/') && !p.startsWith('/courses/explore')),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    href: '/academics',
    label: 'Academics',
    match: p => p.startsWith('/academics') || p.startsWith('/calendar') || p.startsWith('/live') || p.startsWith('/free-resources') || p.startsWith('/feedback') || p.startsWith('/announcements'),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
      </svg>
    ),
  },
  {
    href: '/support',
    label: 'Support',
    hideForRoles: ['ADMIN'],
    match: p => p.startsWith('/support'),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </svg>
    ),
  },
  {
    href: '/menu',
    label: 'More',
    match: p => p === '/profile' || p === '/menu' || p.startsWith('/profile'),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    ),
  },
]

export default function MobileBottomNav({ userRole }: { userRole?: string }) {
  const pathname = usePathname() || ''
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollTop, setLastScrollTop] = useState(0)

  // Reset visibility and clear pending tab on page navigation completion
  useEffect(() => {
    setIsVisible(true)
    setPendingHref(null)
  }, [pathname])

  // Determine if this route should completely hide the bottom nav
  const isCommunity = pathname.startsWith('/community')
  const isLecture = pathname.includes('/lectures/')
  const isSettingsOrProfile = pathname.startsWith('/settings') || pathname.startsWith('/profile')
  const shouldHideCompletely = isCommunity || isLecture || isSettingsOrProfile

  useEffect(() => {
    if (shouldHideCompletely) return

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement
      if (!target) return

      // Read scroll top from target (e.g. <main>), window, or document element
      const currentScrollTop = 
        (typeof target.scrollTop === 'number' ? target.scrollTop : null) ?? 
        window.pageYOffset ?? 
        document.documentElement.scrollTop ?? 
        document.body.scrollTop ?? 
        0
      
      // If we scroll down even a tiny bit, hide immediately
      if (currentScrollTop < 10) {
        setIsVisible(true)
      } else if (currentScrollTop > lastScrollTop) {
        // Scrolling down
        setIsVisible(false)
      } else {
        // Scrolling up
        setIsVisible(true)
      }
      
      setLastScrollTop(currentScrollTop)
    }

    // Capture scroll events from any element (e.g. <main>)
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [lastScrollTop, shouldHideCompletely])

  if (shouldHideCompletely) {
    return null
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 767px) {
          .dashboard-main-container main {
            padding-bottom: calc(84px + max(env(safe-area-inset-bottom, 0px), var(--android-nav-bottom, 0px))) !important;
          }
        }
      `}} />
      <nav 
        className={`mobile-bottom-nav ${isVisible ? 'visible' : 'hidden'}`} 
        aria-label="Primary mobile navigation"
      >
        {TABS.filter(tab => !tab.hideForRoles?.includes(userRole || '')).map(tab => {
          const effectivePath = pendingHref || pathname
          const active = tab.match(effectivePath) || (pendingHref ? tab.href === pendingHref : false)
          const isAcademics = tab.label === 'Academics'
          const tourId = tab.label === 'Courses' ? 'nav-courses' :
                         tab.label === 'Academics' ? 'nav-academics' :
                         tab.label === 'Support' ? 'nav-support' :
                         tab.label === 'More' ? 'nav-more' : undefined
          return (
            <Link 
              key={tab.href} 
              href={tab.href}
              prefetch={true}
              onClick={() => setPendingHref(tab.href)}
              data-tour={tourId}
              className={`mobile-bottom-tab ${active ? 'active' : ''} ${isAcademics ? 'academics-action-tab' : ''}`}
            >
              <div className="tab-icon-wrapper">
                <span className="tab-icon">{tab.icon}</span>
              </div>
              <span className="tab-label">{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
