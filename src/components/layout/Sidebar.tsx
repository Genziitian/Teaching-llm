'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useUserData } from '@/components/UserDataProvider'
import { useLocalCachedAsset } from '@/hooks/useLocalCachedAsset'
import { clearSWRCache } from '@/lib/cache'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles?: string[]
  desktopOnly?: boolean
}

interface SidebarProps {
  userRole: string
  userName: string
  userEmail: string
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    href: '/courses',
    label: 'Courses',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
  {
    href: '/courses/explore',
    label: 'Store',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    href: '/live',
    label: 'Live Sessions',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
  },
  {
    href: '/calendar',
    label: 'Calendar',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/materials',
    label: 'Study Materials',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: '/free-resources',
    label: 'Free Resources',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    ),
  },
  {
    href: '/community',
    label: 'Community',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/activity-logs',
    label: 'Activity Log',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
        <path d="M9 14l2 2 4-4"/>
      </svg>
    ),
  },

  {
    href: '/data-analysis',
    label: 'Data Analysis',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
        <path d="M22 12A10 10 0 0 0 12 2v10z"/>
      </svg>
    ),
  },
  {
    href: '/support',
    label: 'Support',
    roles: ['STUDENT', 'INSTRUCTOR', 'MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: '/feedback',
    label: 'Feedback',
    roles: ['MANAGER', 'ADMIN'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  
  {
    href: '/feedback',
    label: 'Feedback',
    roles: ['STUDENT'],
    desktopOnly: true,
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
    ),
  },
  {
    href: '/manage',
    label: 'Manage',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
  {
    href: '/manage/queries',
    label: 'Queries',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    href: '/transactions',
    label: 'Transactions',
    roles: ['MANAGER'],
    desktopOnly: true,
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" ry="2"/>
        <line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/manage/notifications',
    label: 'Notifications',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
  {
    href: '/announcements',
    label: 'Announcements',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
  {
    href: '/manage/home-slides',
    label: 'Home Carousel',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 3H8"/>
        <path d="M12 3v4"/>
      </svg>
    ),
  },
  {
    href: '/my-transactions',
    label: 'Transactions',
    roles: ['STUDENT'],
    desktopOnly: true,
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    href: '/manage/updates',
    label: 'Updates',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
        <line x1="4" y1="22" x2="4" y2="15"/>
      </svg>
    ),
  },
  {
    href: '/manage/prompts',
    label: 'User Prompts',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
      </svg>
    ),
  },
  {
    href: '/manage/facts',
    label: 'Loading Facts',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    href: '/manage/coupons',
    label: 'Coupons',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4"/>
        <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/>
        <path d="M18 12a2 2 0 000 4h4v-4z"/>
      </svg>
    ),
  },
  {
    href: '/manage/contacts',
    label: 'Synced Contacts',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    ),
  },
  {
    href: '/manage/mail-assigner',
    label: 'Mail Assigner',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
  {
    href: '/admin',
    label: 'User Admin',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/google-sync',
    label: 'Google Sync',
    roles: ['MANAGER'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
    ),
  },
  {
    href: '/company/about-us',
    label: 'About Us',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    ),
  },
]

export default function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const logoSrc = useLocalCachedAsset('/mobile-login-logo.png')
  const pathname = usePathname()
  const router = useRouter()
  const navRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const [canScrollMore, setCanScrollMore] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isManualExpanded, setIsManualExpanded] = useState(false)
  const [isManualCollapsed, setIsManualCollapsed] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // Listen for custom toggle events from the mobile header
  useEffect(() => {
    const handleToggle = () => setIsOpen(v => !v)
    const handleClose = () => setIsOpen(false)

    window.addEventListener('toggle-sidebar', handleToggle)
    window.addEventListener('close-sidebar', handleClose)

    return () => {
      window.removeEventListener('toggle-sidebar', handleToggle)
      window.removeEventListener('close-sidebar', handleClose)
    }
  }, [])

  // Auto-close sidebar and clear pending tab on screen transition (navigation click)
  useEffect(() => {
    setIsOpen(false)
    setIsManualExpanded(false)
    setIsManualCollapsed(false)
    setPendingHref(null)
  }, [pathname])

  // Handle click outside to collapse sidebar on tablets/mobile or desktop manual expand
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      // If the sidebar is expanded or open, and click target is not within the sidebar, collapse it!
      if (
        sidebarRef.current && 
        !sidebarRef.current.contains(e.target as Node)
      ) {
        setIsManualExpanded(false)
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [])

  // Use shared UserDataProvider instead of duplicate SWR/SSE calls
  const { userData, unreadCounts: unread } = useUserData()

  // Use SWR data if available, otherwise fall back to props
  const currentUserName = userData?.user?.name || userName
  const currentUserRole = userData?.user?.role || userRole

  const visibleItems = NAV_ITEMS.filter(
    item => !item.roles || item.roles.includes(currentUserRole)
  )

  const initials = currentUserName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const roleLabel = currentUserRole.charAt(0) + currentUserRole.slice(1).toLowerCase()

  // Scroll indicator
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const check = () => setCanScrollMore(el.scrollHeight > el.clientHeight + el.scrollTop + 4)
    check()
    el.addEventListener('scroll', check)
    window.addEventListener('resize', check)
    return () => {
      el.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [visibleItems])

  async function handleLogout() {
    setIsOpen(false)
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        const { SocialLogin } = await import('@capgo/capacitor-social-login')
        await SocialLogin.logout({ provider: 'google' }).catch(() => {})
        
        const { CapacitorCookies } = await import('@capacitor/core')
        await CapacitorCookies.clearCookies({ url: 'https://class.genziitian.in' }).catch(() => {})
        await CapacitorCookies.clearCookies({ url: window.location.origin }).catch(() => {})
      }
    } catch (e) {
      console.error('Error during native logout cleanup:', e)
    }

    clearSWRCache()
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const [isTabletDevice, setIsTabletDevice] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 768px) and (max-width: 1024px) and (orientation: portrait)')
    setIsTabletDevice(mql.matches)
    const listener = (e: MediaQueryListEvent) => setIsTabletDevice(e.matches)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [])

  const isCurrentlyExpanded = (isHovered && !isTabletDevice && !isManualCollapsed) || isManualExpanded || isOpen

  return (
    <>
      <div 
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`} 
        onClick={() => setIsOpen(false)} 
      />
      {/* Desktop Permanent Corner-Fixed Logo */}
      <div className={`sidebar-desktop-logo-fixed-container ${isTabletDevice ? 'is-tablet-device' : ''}`} style={{
        position: 'fixed',
        left: '12px',
        top: isTabletDevice ? '12px' : '24px',
        zIndex: 110,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '4px',
      }}>
        <Link href="/dashboard" className="sidebar-logo-plate" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          width: isTabletDevice ? '110px' : '140px',
          minHeight: isTabletDevice ? '52px' : '74px',
          padding: isTabletDevice ? '6px 10px' : '10px 14px',
          borderRadius: isTabletDevice ? '10px' : '14px',
          background: 'linear-gradient(145deg, #f6f7fb, var(--border))',
          boxShadow: 'none',
          cursor: 'pointer',
        }}>
          <img
            src={logoSrc}
            alt="GenZ IITIAN Logo"
            className="sidebar-logo-img"
            style={{
              width: '100%',
              height: 'auto', 
              maxHeight: isTabletDevice ? '36px' : '50px',
              objectFit: 'contain',
              display: 'block',
            }} 
          />
        </Link>
        {!isTabletDevice && currentUserRole && (
          <div style={{
            fontSize: '12px',
            fontWeight: '700',
            color: 'var(--text-secondary)',
            letterSpacing: '0.06em',
            paddingLeft: '12px',
            textTransform: 'uppercase',
            opacity: 0.8,
            fontFamily: "'Outfit', 'Nunito', sans-serif",
            marginBottom: '40px',
          }}>
            {currentUserRole} Portal
          </div>
        )}
      </div>

      <nav 
        ref={sidebarRef}
        className={`sidebar-nav ${isOpen ? 'sidebar-open' : ''} ${isCurrentlyExpanded ? 'desktop-expanded' : 'desktop-collapsed'} ${isTabletDevice ? 'is-tablet-device' : ''}`}
        onMouseLeave={() => {
          setIsHovered(false)
          if (!isTabletDevice) {
            setIsManualCollapsed(false)
            setIsManualExpanded(false)
          }
        }}
        style={{
          width: isOpen ? '240px' : (isCurrentlyExpanded ? '240px' : '76px'),
        }}
      >
        {/* Navigation items rounded vertical container */}
        <div
          ref={navRef}
          className="sidebar-vertical-container"
          onMouseEnter={() => setIsHovered(true)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            overflow: 'hidden',
          }}
        >
          {/* Scrollable list of items */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: isTabletDevice ? '1.8vh' : '8px',
              overflowY: 'auto',
              width: '100%',
              paddingRight: '2px',
            }}
            className="sidebar-scrollable-content"
          >
            {visibleItems.map((item, idx) => {
              const effectivePath = pendingHref || pathname
              const isActive = effectivePath === item.href ||
                (item.href !== '/dashboard' && item.href !== '/courses/explore' && effectivePath.startsWith(item.href) && 
                 (effectivePath[item.href.length] === '/' || effectivePath[item.href.length] === undefined) && !effectivePath.startsWith('/courses/explore') &&
                 !(item.href === '/manage' && (effectivePath.startsWith('/manage/prompts') || effectivePath.startsWith('/manage/updates') || effectivePath.startsWith('/manage/coupons') || effectivePath.startsWith('/manage/notifications') || effectivePath.startsWith('/manage/home-slides') || effectivePath.startsWith('/manage/contacts') || effectivePath.startsWith('/manage/mail-assigner') || effectivePath.startsWith('/manage/facts'))))

              const isStore = item.href === '/courses/explore'
              const getLinkStyle = () => {
                const minHeight = 'clamp(40px, 5.2vh, 48px)'
                const padding = isCurrentlyExpanded ? '10px 16px' : '10px 0'
                const borderRadius = isTabletDevice ? '10px' : '12px'
                const fontSize = isTabletDevice ? '13px' : '14px'

                if (isStore) {
                  return {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCurrentlyExpanded ? 'flex-start' : 'center',
                    gap: isCurrentlyExpanded ? '12px' : '0px',
                    padding,
                    borderRadius,
                    color: '#ffffff',
                    background: 'linear-gradient(135deg, #4b5563, #1f2937)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                    textDecoration: 'none',
                    fontSize,
                    fontWeight: '800',
                    transition: 'all 0.2s ease',
                    position: 'relative' as const,
                    whiteSpace: 'nowrap' as const,
                    overflow: 'hidden' as const,
                    minHeight,
                    height: 'auto',
                    width: '100%',
                  }
                }
                return {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCurrentlyExpanded ? 'flex-start' : 'center',
                  gap: isCurrentlyExpanded ? '12px' : '0px',
                  padding,
                  borderRadius,
                  color: isActive ? 'var(--sidebar-active-text, #ffffff)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--sidebar-active, var(--primary))' : 'transparent',
                  border: isActive ? '1px solid var(--sidebar-active-border, transparent)' : '1px solid transparent',
                  boxShadow: isActive
                    ? 'var(--shadow-sm)'
                    : 'none',
                  textDecoration: 'none',
                  fontSize,
                  fontWeight: isActive ? '700' : '500',
                  transition: 'all 0.2s ease',
                  position: 'relative' as const,
                  whiteSpace: 'nowrap' as const,
                  minHeight,
                  height: 'auto',
                  width: '100%',
                }
              }

              const tourId = item.href === '/courses' ? 'sidebar-courses' :
                             item.href === '/free-resources' ? 'sidebar-academics' :
                             item.href === '/community' ? 'sidebar-community' :
                             item.href === '/support' ? 'sidebar-support' :
                             item.href === '/settings' ? 'sidebar-settings' : undefined

              return (
                <div key={item.href} className={item.desktopOnly ? 'desktop-only-nav-item' : undefined} style={{ width: '100%' }}>
                  <Link
                    href={item.href}
                    prefetch={true}
                    data-tour={tourId}
                    style={getLinkStyle()}
                    className={`sidebar-link-item ${isActive ? 'active' : ''} ${isStore ? 'store-link' : ''}`}
                    onClick={() => {
                      setPendingHref(item.href)
                      setIsOpen(false)
                    }}
                    title={!isCurrentlyExpanded ? item.label : undefined}
                  >
                    <span 
                      className="sidebar-link-icon"
                      style={{
                        color: isStore ? '#ffffff' : (isActive ? 'var(--sidebar-active-text, #ffffff)' : 'var(--text-secondary)'),
                        flexShrink: 0,
                        display: 'flex',
                        position: 'relative',
                        zIndex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '24px',
                      }}
                    >
                      {item.icon}
                    </span>
                    <span 
                      className="sidebar-link-label"
                      style={{
                        opacity: isCurrentlyExpanded ? 1 : 0,
                        width: isCurrentlyExpanded ? 'auto' : 0,
                        overflow: 'hidden',
                        transition: 'opacity 0.2s ease, width 0.2s ease',
                        zIndex: 1,
                        position: 'relative',
                        whiteSpace: 'nowrap',
                        marginLeft: isCurrentlyExpanded ? '4px' : '0px',
                      }}
                    >
                      {item.label}
                    </span>
                  </Link>
                </div>
              )
            })}
          </div>

        </div>

        {/* Separate Sign Out / Expand Card */}
        <div className="sidebar-logout-card" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: isTabletDevice ? '6px' : '8px',
          marginTop: 'auto',
        }}>
          {isCurrentlyExpanded ? (
            <>
              {/* Sign Out Button (First) */}
              <button
                onClick={() => setShowLogoutConfirm(true)}
                title="Sign Out"
                className="sidebar-logout-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '12px',
                  padding: '10px 16px',
                  borderRadius: isTabletDevice ? '10px' : '12px',
                  color: 'var(--danger)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: isTabletDevice ? '13px' : '14.5px',
                  fontWeight: '500',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  width: '100%',
                  minHeight: 'clamp(40px, 5.2vh, 48px)',
                  height: 'auto',
                  flexShrink: 0,
                }}
              >
                <span style={{ color: 'var(--danger)', flexShrink: 0, display: 'flex', width: '24px', justifyContent: 'center' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </span>
                <span style={{
                  opacity: 1,
                  width: 'auto',
                  overflow: 'hidden',
                  transition: 'opacity 0.2s ease, width 0.2s ease',
                  whiteSpace: 'nowrap',
                  marginLeft: '4px',
                }}>
                  Sign Out
                </span>
              </button>

              {/* Collapse Button (Second) */}
              <button
                onClick={() => {
                  setIsManualCollapsed(true)
                  setIsManualExpanded(false)
                }}
                title="Collapse Sidebar"
                className="sidebar-collapse-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '12px',
                  padding: '10px 16px',
                  borderRadius: isTabletDevice ? '10px' : '12px',
                  color: 'var(--text-secondary)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: isTabletDevice ? '13px' : '14.5px',
                  fontWeight: '500',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  width: '100%',
                  minHeight: 'clamp(40px, 5.2vh, 48px)',
                  height: 'auto',
                  flexShrink: 0,
                }}
              >
                <span style={{ color: 'var(--text-secondary)', flexShrink: 0, display: 'flex', width: '24px', justifyContent: 'center' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="11 17 6 12 11 7" />
                    <polyline points="18 17 13 12 18 7" />
                  </svg>
                </span>
                <span style={{
                  opacity: 1,
                  width: 'auto',
                  overflow: 'hidden',
                  transition: 'opacity 0.2s ease, width 0.2s ease',
                  whiteSpace: 'nowrap',
                  marginLeft: '4px',
                }}>
                  Collapse
                </span>
              </button>
            </>
          ) : (
            /* Expand Button (when collapsed) */
            <button
              onClick={() => {
                setIsManualExpanded(true)
                setIsManualCollapsed(false)
              }}
              title="Expand Sidebar"
              className="sidebar-expand-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0px',
                padding: '10px 0',
                borderRadius: isTabletDevice ? '10px' : '12px',
                color: 'var(--text-secondary)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: '100%',
                minHeight: 'clamp(40px, 5.2vh, 48px)',
                height: 'auto',
                flexShrink: 0,
              }}
            >
              <span style={{ flexShrink: 0, display: 'flex', width: '24px', justifyContent: 'center' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="13 17 18 12 13 7" />
                  <polyline points="6 17 11 12 6 7" />
                </svg>
              </span>
            </button>
          )}
        </div>

      </nav>

      {/* Logout Confirmation Modal Overlay */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(9, 9, 20, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
        }}>
          <div style={{
            background: 'rgba(23, 23, 38, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '32px 28px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              color: 'var(--danger)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            
            <h3 style={{
              fontSize: '20px',
              fontWeight: '750',
              color: '#ffffff',
              margin: '0 0 8px 0',
              fontFamily: "'Outfit', 'Nunito', sans-serif",
            }}>
              Sign Out
            </h3>
            
            <p style={{
              fontSize: '14.5px',
              color: '#cbd5e1',
              margin: '0 0 24px 0',
              lineHeight: '1.45',
              fontWeight: '550',
            }}>
              Are you sure you want to sign out? Your current session will be ended.
            </p>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              width: '100%',
            }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#e2e8f0',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false)
                  handleLogout()
                }}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  borderRadius: '12px',
                  background: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
