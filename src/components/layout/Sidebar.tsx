'use client'

import Link from 'next/link'
import { canSeeProtectionOnWeb } from '@/lib/exam-protection/access'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useUserData } from '@/components/UserDataProvider'
import { useLocalCachedAsset } from '@/hooks/useLocalCachedAsset'
import { clearSWRCache } from '@/lib/cache'
import { QUIZ_LAB_URL, QUIZ_LAB_LOGO } from '@/components/home/QuizLabBanner'
import UserAvatar from '@/components/UserAvatar'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles?: string[]
  protectionPreview?: boolean
  desktopOnly?: boolean
  /** Link to another site: rendered as a plain <a>, highlighted. */
  external?: boolean
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
    href: '/exam-protection',
    label: 'Exam Protection',
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="m8 12 3 3 5-6"/></svg>,
    roles: ['STUDENT', 'MANAGER'],
    protectionPreview: true,
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
    href: QUIZ_LAB_URL,
    label: 'Quiz Lab',
    external: true,
    icon: (
      <img src={QUIZ_LAB_LOGO} alt="" width={24} height={24} className="quiz-lab-logo" />
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
    roles: ['MANAGER', 'ADMIN', 'MODERATOR'],
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
    roles: ['MANAGER', 'MODERATOR'],
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
    roles: ['MANAGER', 'MODERATOR'],
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
    roles: ['STUDENT', 'MANAGER', 'MODERATOR'],
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l18-5v12L3 14v-3z"/>
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
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


const NAV_GROUPS: { title: string; hrefs: string[] }[] = [
  { title: 'Learn', hrefs: ['/dashboard', '/courses', '/live', '/calendar', '/free-resources', '/materials'] },
  { title: 'Explore', hrefs: ['/courses/explore', QUIZ_LAB_URL, '/exam-protection'] },
  { title: 'Connect', hrefs: ['/community', '/announcements', '/support', '/feedback'] },
  { title: 'Manage', hrefs: ['/manage', '/manage/queries', '/manage/notifications', '/manage/updates', '/manage/prompts', '/manage/facts', '/manage/coupons', '/manage/mail-assigner'] },
  { title: 'Admin', hrefs: ['/admin', '/transactions', '/activity-logs', '/data-analysis', '/google-sync'] },
  { title: 'Company', hrefs: ['/company/about-us'] },
]

export default function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const logoSrc = useLocalCachedAsset('/mobile-login-logo.png')
  const pathname = usePathname()
  const router = useRouter()
  const sidebarRef = useRef<HTMLElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isRail, setIsRail] = useState(false)

  // Mobile drawer: toggled from the mobile header
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

  // Close drawer / menu and clear the optimistic active item after navigation
  useEffect(() => {
    setIsOpen(false)
    setShowUserMenu(false)
    setPendingHref(null)
  }, [pathname])

  // Click outside closes the user menu and the mobile drawer
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [])

  // Tablet widths get an icon rail; desktop gets the full sidebar
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 768px) and (max-width: 1099px)')
    setIsRail(mql.matches)
    const listener = (e: MediaQueryListEvent) => setIsRail(e.matches)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [])

  const { userData, unreadCounts: unread } = useUserData()

  const currentUserName = userData?.user?.name || userName
  const currentUserRole = userData?.user?.role || userRole
  const currentUserEmail = userData?.user?.email || userEmail

  const visibleItems = NAV_ITEMS.filter(
    item => (!item.roles || item.roles.includes(currentUserRole)) && (!item.protectionPreview || canSeeProtectionOnWeb(currentUserRole, userData?.user?.email))
  )

  const roleLabel = currentUserRole.charAt(0) + currentUserRole.slice(1).toLowerCase()

  // Section the visible items; anything not listed lands in "More" so nothing disappears
  const placed = new Set<NavItem>()
  const groups = NAV_GROUPS.map(g => {
    const items = g.hrefs
      .map(h => visibleItems.find(i => i.href === h && !placed.has(i)))
      .filter((i): i is NavItem => !!i)
    items.forEach(i => placed.add(i))
    return { title: g.title, items }
  })
  const leftovers = visibleItems.filter(i => !placed.has(i))
  if (leftovers.length) groups.splice(groups.length - 1, 0, { title: 'More', items: leftovers })
  const visibleGroups = groups.filter(g => g.items.length > 0)

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

  const effectivePath = pendingHref || pathname
  const isItemActive = (item: NavItem) =>
    effectivePath === item.href ||
    (item.href !== '/dashboard' && item.href !== '/courses/explore' && effectivePath.startsWith(item.href) &&
      (effectivePath[item.href.length] === '/' || effectivePath[item.href.length] === undefined) && !effectivePath.startsWith('/courses/explore') &&
      !(item.href === '/free-resources' && effectivePath.startsWith('/free-resources/purchased')) &&
      !(item.href === '/manage' && (effectivePath.startsWith('/manage/prompts') || effectivePath.startsWith('/manage/updates') || effectivePath.startsWith('/manage/coupons') || effectivePath.startsWith('/manage/notifications') || effectivePath.startsWith('/manage/contacts') || effectivePath.startsWith('/manage/mail-assigner') || effectivePath.startsWith('/manage/facts'))))

  const tourIdFor = (href: string) =>
    href === '/courses' ? 'sidebar-courses' :
    href === '/free-resources' ? 'sidebar-academics' :
    href === '/community' ? 'sidebar-community' :
    href === '/support' ? 'sidebar-support' :
    href === '/settings' ? 'sidebar-settings' : undefined

  // Boolean "something new" flags from /api/unread
  const hasNew = (href: string) =>
    (href === '/community' && !!unread?.community) ||
    (href === '/support' && !!unread?.support) ||
    (href === '/announcements' && !!unread?.announcements)

  const renderItem = (item: NavItem) => {
    const active = !item.external && isItemActive(item)
    const showLabel = !isRail || isOpen
    const inner = (
      <>
        <span className="gz-nav__icon">{item.icon}</span>
        {showLabel && <span className="gz-nav__label">{item.label}</span>}
        {showLabel && item.external && <span className="gz-badge gz-badge--green">NEW</span>}
        {showLabel && !item.external && hasNew(item.href) && <span className="gz-badge">New</span>}
      </>
    )
    if (item.external) {
      return (
        <a key={item.href} href={item.href} className="gz-nav" onClick={() => setIsOpen(false)} title={item.label}>
          {inner}
        </a>
      )
    }
    return (
      <Link
        key={`${item.href}-${item.label}`}
        href={item.href}
        prefetch={true}
        data-tour={tourIdFor(item.href)}
        className={`gz-nav ${active ? 'active' : ''} ${item.desktopOnly ? 'desktop-only-nav-item' : ''}`}
        onClick={() => { setPendingHref(item.href); setIsOpen(false) }}
        title={item.label}
      >
        {inner}
      </Link>
    )
  }

  const showLabels = !isRail || isOpen

  return (
    <>
      <div className={`gz-scrim ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(false)} />
      <nav
        ref={sidebarRef}
        aria-label="Primary"
        className={`gz-side ${isRail ? 'is-rail' : ''} ${isOpen ? 'is-open' : ''}`}
      >
        <Link href="/dashboard" className="gz-side__logo" title="GenZ IITian">
          <img src={logoSrc} alt="GenZ IITian" />
        </Link>

        <div className="gz-side__scroll">
          {visibleGroups.map(g => (
            <div className="gz-side__group" key={g.title}>
              {showLabels && <div className="gz-side__title">{g.title}</div>}
              {g.items.map(renderItem)}
            </div>
          ))}
        </div>

        <div className="gz-side__foot" data-tour="web-header-user">
          {showUserMenu && (
            <div className="gz-menu" role="menu">
              <div className="gz-menu__who">
                <b>{currentUserName}</b>
                <span>{currentUserEmail}</span>
              </div>
              <Link href="/profile" className="gz-menu__item" role="menuitem" onClick={() => setShowUserMenu(false)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                My Profile
              </Link>
              <Link href="/settings" className="gz-menu__item" role="menuitem" onClick={() => setShowUserMenu(false)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                Settings
              </Link>
              <div className="gz-menu__sep" />
              <button className="gz-menu__item gz-menu__item--danger" role="menuitem" onClick={() => { setShowUserMenu(false); setShowLogoutConfirm(true) }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                Sign Out
              </button>
            </div>
          )}
          <button className="gz-user" onClick={() => setShowUserMenu(v => !v)} aria-haspopup="menu" aria-expanded={showUserMenu} title="My Account & Profile">
            <UserAvatar user={userData?.user ? userData.user : { name: currentUserName }} size={32} />
            {showLabels && (
              <>
                <span className="gz-user__txt">
                  <span className="gz-user__name">{currentUserName}</span>
                  <span className="gz-user__role">{roleLabel}</span>
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gz-ink-4)' }}><polyline points="7 15 12 20 17 15" /><polyline points="7 9 12 4 17 9" /></svg>
              </>
            )}
          </button>
        </div>
      </nav>

      {showLogoutConfirm && (
        <div className="gz-modal-scrim" onClick={() => setShowLogoutConfirm(false)}>
          <div className="gz-modal" role="dialog" aria-modal="true" aria-labelledby="gz-logout-title" onClick={e => e.stopPropagation()}>
            <div className="gz-modal__icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            </div>
            <h3 id="gz-logout-title">Sign out?</h3>
            <p>Your current session will be ended.</p>
            <div className="gz-modal__actions">
              <button className="gz-btn gz-btn--ghost" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="gz-btn gz-btn--danger" onClick={() => { setShowLogoutConfirm(false); handleLogout() }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
