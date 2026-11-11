'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useUserData } from '@/components/UserDataProvider'
import UserAvatar from '@/components/UserAvatar'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useTheme } from '@/components/ThemeProvider'
import { useLanguage } from '@/contexts/LanguageContext'

interface HeaderProps {
  userName: string
  userRole: string
}

interface Notification {
  id: string
  title: string
  content: string
  type: string
  isRead: boolean
  announcementId: string | null
  createdAt: string
}

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':  { title: 'Dashboard',        subtitle: 'Welcome back to your learning hub' },
  '/courses/explore': { title: 'GenZ IITian Official Store', subtitle: 'You can also buy courses from ' },
  '/courses':    { title: 'Courses',          subtitle: 'Your enrolled subjects and lectures' },
  '/academics':  { title: 'Academics',        subtitle: 'Everything for your learning journey' },
  '/menu':       { title: 'Profile',          subtitle: 'View and edit your personal information' },
  '/live':       { title: 'Live Sessions',     subtitle: "Today's schedule" },
  '/calendar':   { title: 'Calendar',          subtitle: 'Your schedule and upcoming events' },
  '/materials/recordings': { title: 'Recordings',        subtitle: 'Browse lecture recordings' },
  '/materials':  { title: 'Study Resources',   subtitle: 'Download notes and resources' },
    '/community':  { title: 'Community',         subtitle: 'Connect with your coursemates' },
  '/announcements': { title: 'Announcements',  subtitle: 'Stay updated with the latest news' },
  '/support':    { title: 'Contact & Support', subtitle: 'Raise a ticket or chat with support' },
  '/manage/prompts/': { title: 'Prompt Responses', subtitle: 'View gathered feedback from users' },
  '/manage/prompts': { title: 'User Prompts', subtitle: 'Create and manage quick feedback prompts for users' },
  '/manage/updates': { title: 'Update System', subtitle: 'Manage greetings, updates, and user messages' },
  '/manage/coupons': { title: 'Coupon Management', subtitle: 'Create and manage discount coupons' },
  '/manage/facts': { title: 'Loading Facts', subtitle: 'Add, edit, search and rarity-tag facts shown on loading screens' },
  '/manage':     { title: 'Manage Content',    subtitle: 'Create and edit courses, lectures, and sessions' },
  '/company/about-us': { title: 'About Us', subtitle: 'Learn more about GenZ IITian and our team' },
  '/company/': { title: 'Company Policy', subtitle: 'View terms, privacy and company details' },
  '/admin':      { title: 'User Management',   subtitle: 'Manage platform accounts and permissions' },
  '/profile':    { title: 'My Profile',         subtitle: 'View and edit your personal information' },
  '/settings':   { title: 'Settings',          subtitle: 'Manage passwords, appearance, and notifications' },
  '/chat-transcripts': { title: 'Chat Transcripts', subtitle: 'View community chat transcripts' },
  '/activity-logs': { title: 'Activity Log',     subtitle: 'Monitor all platform activity and user actions' },
  '/data-analysis': { title: 'Data Analysis',      subtitle: 'Production-level insights and student behavior metrics' },
  '/feedback':   { title: 'Feedback',           subtitle: 'Average ratings and student reviews.' },
  '/free-resources/courses': { title: 'Free Courses', subtitle: '' },
  '/free-resources/materials': { title: 'Free Materials', subtitle: '' },
  '/free-resources/purchased': { title: 'Purchased Materials', subtitle: '' },
  '/free-resources': { title: 'Free Resources', subtitle: '' },
  '/transactions': { title: 'Transactions', subtitle: 'All student payments and revenue' },
  '/my-transactions': { title: 'My Transaction History', subtitle: 'View all your course transactions and upgrades' },
}


type NotifCategory = 'all' | 'announcements' | 'live' | 'community' | 'support' | 'purchases'

const NOTIF_TABS: { key: NotifCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'live', label: 'Live' },
  { key: 'community', label: 'Community' },
  { key: 'support', label: 'Support' },
  { key: 'purchases', label: 'Purchases' },
]

// d = SVG path (24px grid), tone/tint = text + chip colour tokens
const NOTIF_KIND: Record<Exclude<NotifCategory, 'all'> | 'other', { tag: string; d: string; cls: string }> = {
  announcements: { tag: 'Announcement', d: 'M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6', cls: 'amber' },
  live: { tag: 'Live session', d: 'M23 7l-7 5 7 5V7zM3 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', cls: 'green' },
  community: { tag: 'Community', d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', cls: 'blue' },
  support: { tag: 'Support', d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', cls: 'purple' },
  purchases: { tag: 'Purchase', d: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM2 10h20', cls: 'neutral' },
  other: { tag: 'Update', d: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 16v-4M12 8h.01', cls: 'neutral' },
}

function categorize(n: { type: string; title: string; announcementId: string | null }): Exclude<NotifCategory, 'all'> | 'other' {
  const type = (n.type || '').toLowerCase()
  const title = (n.title || '').toLowerCase()
  if (n.announcementId) return 'announcements'
  if (type === 'community') return 'community'
  if (title.includes('live') || title.includes('session') || title.includes('class')) return 'live'
  if (title.includes('support') || title.includes('ticket') || title.includes('chat') || title.includes('agent')) return 'support'
  if (title.includes('purchase') || title.includes('payment') || title.includes('order')) return 'purchases'
  if (title.includes('announcement')) return 'announcements'
  return 'other'
}

function relTime(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24 && d.toDateString() === new Date().toDateString()) return `${hr}h ago`
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function dayBucket(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return 'Earlier'
}

export default function Header({ userName, userRole }: HeaderProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  // const [notifications, setNotifications] = useState<Notification[]>([]) - Removed in favor of SWR
  const [showNotif, setShowNotif] = useState(false)
  const [notifTab, setNotifTab] = useState<NotifCategory>('all')
  const [mounted, setMounted] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const themeCtx = useTheme()
  const fetcher = (url: string) => fetch(url).then(r => r.json())

  const stripFcmMeta = (content: string): string => {
    const metaRegex = /<!-- fcm_meta:({.*?}) -->$/
    return content.replace(metaRegex, '').trim()
  }

  // Use shared UserDataProvider instead of duplicate SWR/SSE calls
  const { userData, notifications, mutateNotifications } = useUserData()

  // Push notifications hook & native status state
  const { isSupported, isSubscribed, subscribe, unsubscribe } = usePushNotifications()
  const [isNativeApp, setIsNativeApp] = useState(false)
  const [nativeSubscribed, setNativeSubscribed] = useState(false)

  useEffect(() => {
    const checkNativeStatus = async () => {
      const { isCapacitorNative, checkCapacitorPermission } = await import('@/lib/capacitor-push')
      if (isCapacitorNative()) {
        setIsNativeApp(true)
        const perm = await checkCapacitorPermission()
        const storedPref = localStorage.getItem('push_enabled')
        setNativeSubscribed(perm === 'granted' && storedPref !== 'false')
      }
    }
    checkNativeStatus()
  }, [])

  // Fetch current user info from shared provider
  // Use SWR data if available, otherwise fall back to props
  const currentUserName = userData?.user?.name || userName
  const currentUserRole = userData?.user?.role || userRole
  // Use current user's profile picture or default gender avatar
  const currentAvatarUser = userData?.user ? userData.user : { name: currentUserName, avatar, gender: userData?.user?.gender }

  const unreadCount = notifications.filter(n => !n.isRead).length

  // Sort keys by length descending to match the most specific path first
  const matchedKey = Object.keys(PAGE_TITLES)
    .sort((a, b) => b.length - a.length)
    .find(key => key === pathname || (key !== '/dashboard' && pathname.startsWith(key)))

  let pageInfo = matchedKey ? { ...PAGE_TITLES[matchedKey] } : { title: 'Dashboard', subtitle: '' }

  // Dynamic Live Sessions Subtitle Override with Date
  if (matchedKey === '/live') {
    const todayStr = new Date().toLocaleDateString('en-GB', { month: '2-digit', day: '2-digit', year: 'numeric' })
    pageInfo.subtitle = `Today's Schedule • ${todayStr}`
  }

  // Dynamic Tab Overrides for Manage Sub-dashboards
  if (pathname === '/manage') {
    const MANAGE_TAB_INFO: Record<string, { title: string; subtitle: string }> = {
      courses: { title: 'Manage Courses', subtitle: 'Create and edit subjects and schedules' },
      offerings: { title: 'Course Offerings', subtitle: 'Configure premium recorded and live access tiers' },
      bundles: { title: 'Course Bundles', subtitle: 'Group multiple courses into packages' },
      lectures: { title: 'Lectures Manager', subtitle: 'Upload and schedule course lecture videos' },
      events: { title: 'Events & Live Sessions', subtitle: 'Create and manage online classes, exams and holidays' },
      materials: { title: 'Study Materials', subtitle: 'Manage downloadable notes and PDFs for subjects' },
      announcements: { title: 'Announcements Fan-Out', subtitle: 'Publish platform-wide announcements and update notifications' },
      notifications: { title: 'Push Notifications', subtitle: 'Broadcast notifications and marketing campaigns to students' },
    }
    const tabInfo = MANAGE_TAB_INFO[tab || 'courses']
    if (tabInfo) {
      pageInfo = tabInfo
    }
  }

  // Pages that get the time-based greeting headline on desktop instead of the page title.
  const greetingPages = new Set(['/dashboard'])
  const showGreetingHeadline = matchedKey ? greetingPages.has(matchedKey) : false

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) {
      return {
        heading: t('dashboard.greeting.morning'),
        subtext: 'Hope you’re ready for a productive day ahead.'
      }
    }
    if (hour >= 12 && hour < 17) {
      return {
        heading: t('dashboard.greeting.afternoon'),
        subtext: 'Keep going strong, you’re making great progress.'
      }
    }
    if (hour >= 17 && hour < 21) {
      return {
        heading: t('dashboard.greeting.evening'),
        subtext: 'Take a moment to relax and review your day.'
      }
    }
    return {
      heading: t('dashboard.greeting.night'),
      subtext: 'You’ve done well today. Get some good rest.'
    }
  }

  // const [notifications, setNotifications] = useState<Notification[]>([]) - Removed

  // Initials and other logic

  // Load user profile
  useEffect(() => {
    setMounted(true)
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        if (data.user?.avatar) setAvatar(data.user.avatar)
      })
      .catch(() => {})
  }, [])

  // Swipe to go back gesture (Android / iOS style)
  useEffect(() => {
    if (typeof window === 'undefined') return
    let touchStartX = 0
    let touchStartY = 0

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      // Start near the left edge of the screen (e.g., within 45px)
      if (touch.clientX < 45) {
        touchStartX = touch.clientX
        touchStartY = touch.clientY
      } else {
        touchStartX = 0
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX === 0) return
      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartX
      const deltaY = Math.abs(touch.clientY - touchStartY)

      // Swipe to the right significantly (e.g., > 90px) with minimal vertical scroll (< 40px)
      if (deltaX > 90 && deltaY < 40) {
        router.back()
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [router])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function markRead(n: Notification) {
    await fetch(`/api/notifications/${n.id}`, { method: 'PUT' })
    mutateNotifications() // Refresh SWR data
    setShowNotif(false)

    if (n.announcementId) {
      router.push(`/announcements?id=${n.announcementId}`)
      return
    }

    const typeLower = (n.type || '').toLowerCase()
    const titleLower = (n.title || '').toLowerCase()

    if (typeLower === 'community') {
      router.push('/community')
    } else if (titleLower.includes('support ticket') || titleLower.includes('chat') || titleLower.includes('agent joined')) {
      router.push('/support')
    } else if (titleLower.includes('lecture')) {
      router.push('/courses')
    } else if (titleLower.includes('course purchased') || titleLower.includes('new course purchase')) {
      router.push(currentUserRole === 'STUDENT' ? '/courses' : '/admin')
    } else {
      // Default fallback
      router.push('/dashboard')
    }
  }

  // One request for all of them (one request per notification tripped the rate limiter)
  async function markAllRead() {
    if (!notifications.some(n => !n.isRead)) return
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' })
    } finally {
      mutateNotifications()
    }
  }

  const firstName = currentUserName.split(' ')[0]
  const isHomePage = pathname === '/dashboard'

  const pushOn = isNativeApp ? nativeSubscribed : isSubscribed
  const pushAvailable = isNativeApp || isSupported
  const onPushChange = async (v: boolean) => {
    if (isNativeApp) {
      const { registerCapacitorPush, unregisterCapacitorPush } = await import('@/lib/capacitor-push')
      if (v) {
        const success = await registerCapacitorPush()
        if (success) {
          setNativeSubscribed(true)
          localStorage.setItem('push_enabled', 'true')
        } else {
          alert('Could not enable push notifications. Please check your system notification settings.')
        }
      } else {
        await unregisterCapacitorPush()
        setNativeSubscribed(false)
        localStorage.setItem('push_enabled', 'false')
      }
      return
    }
    if (v) {
      if (typeof window !== 'undefined' && window.Notification?.permission === 'denied') {
        window.dispatchEvent(new CustomEvent('show-push-blocked-modal'))
        return
      }
      await subscribe()
    } else {
      await unsubscribe()
    }
  }

  const decorated = notifications.map(n => {
    const cat = categorize(n)
    return { n, cat, kind: NOTIF_KIND[cat] }
  })
  const countFor = (key: NotifCategory) => key === 'all' ? decorated.length : decorated.filter(x => x.cat === key).length
  const shown = decorated.filter(x => notifTab === 'all' || x.cat === notifTab)
  const dayGroups = ['Today', 'Yesterday', 'Earlier']
    .map(title => ({ title, items: shown.filter(x => dayBucket(x.n.createdAt) === title) }))
    .filter(g => g.items.length > 0)

  const cycleTheme = () => {
    const { resolvedTheme, setTheme, lightHidden } = themeCtx
    if (lightHidden) setTheme(resolvedTheme === 'dark' ? 'black' : 'dark')
    else if (resolvedTheme === 'light') setTheme('dark')
    else if (resolvedTheme === 'dark') setTheme('black')
    else setTheme('light')
  }
  const themeTitle =
    themeCtx.resolvedTheme === 'light' ? 'Switch to Dark Mode'
    : themeCtx.resolvedTheme === 'dark' ? 'Switch to Black Mode'
    : themeCtx.lightHidden ? 'Switch to Dark Mode' : 'Switch to Light Mode'

  return (
    <header className={`dashboard-header ${!isHomePage ? 'mobile-hide-header' : ''}`}>
      <div className="header-inner-container" style={{ width: '100%', display: 'flex', minWidth: 0 }}>
        {/* Mobile: menu button (bottom nav handles most navigation) */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
          className="sidebar-toggle-btn"
          title="Toggle Navigation Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="12" x2="20" y2="12"></line>
            <line x1="4" y1="6" x2="20" y2="6"></line>
            <line x1="4" y1="18" x2="20" y2="18"></line>
          </svg>
        </button>

        {/* Mobile-only greeting (home) */}
        {isHomePage && (
          <a href="/profile" className="mobile-header-greeting" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <UserAvatar user={currentAvatarUser} size={44} />
            <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--gz-ink)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                {mounted ? getGreeting().heading : 'Welcome'}, {firstName}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--gz-ink-3)', lineHeight: 1.3, marginTop: '3px' }}>
                {mounted ? getGreeting().subtext : 'Loading your dashboard...'}
              </span>
            </div>
          </a>
        )}

        {/* Mobile-only page title */}
        {!isHomePage && (
          <div className="mobile-header-back-title" style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--gz-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pageInfo.title}
            </span>
          </div>
        )}

        {/* Desktop / tablet title */}
        <div className="gz-head__titles">
          {showGreetingHeadline ? (
            <>
              <h1 data-snow="text">{mounted ? getGreeting().heading : 'Welcome'}, {firstName}</h1>
              <p>{mounted ? getGreeting().subtext : 'Loading your dashboard...'}</p>
            </>
          ) : (
            <>
              <h1>{pageInfo.title}</h1>
              {pageInfo.subtitle ? (
                <p>
                  {pageInfo.subtitle}
                  {matchedKey === '/courses/explore' && (
                    <a
                      href="https://app.genziitian.in/courses"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gz-btn"
                      style={{ height: '24px', padding: '0 9px', fontSize: '11.5px', marginLeft: '8px', borderRadius: '7px' }}
                    >
                      Visit Here
                    </a>
                  )}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="gz-head__actions">
          <a href="/download" target="_blank" rel="noopener noreferrer" className="gz-ctl gz-ctl--text download-btn" title="Download Android APP">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="gz-ctl__label">Download App</span>
          </a>

          <button onClick={cycleTheme} title={themeTitle} aria-label={themeTitle} className="gz-ctl gz-ctl--icon theme-toggle-btn">
            {themeCtx.resolvedTheme === 'black' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 0 1 0-16z" /></svg>
            ) : themeCtx.resolvedTheme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            )}
          </button>

          <div ref={notifRef} className="header-notif" style={{ position: 'relative' }}>
            <button
              className={`gz-ctl gz-ctl--icon gz-bell ${showNotif ? 'gz-ctl--on' : ''}`}
              onClick={() => setShowNotif(v => !v)}
              title="Notifications & Announcements"
              aria-label="Notifications"
              aria-expanded={showNotif}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && <span className="gz-bell__count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>

            {showNotif && (
              <>
                <div className="gz-notif-scrim" onClick={() => setShowNotif(false)} />
                <section className="gz-notif notification-dropdown" aria-label="Notifications">
                  <div className="gz-notif__head">
                    <h2>Notifications</h2>
                    {unreadCount > 0 && <button className="gz-link-btn" onClick={markAllRead}>Mark all read</button>}
                    <button className="gz-x" aria-label="Close" onClick={() => setShowNotif(false)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                    </button>
                  </div>
                  <div className="gz-seg" role="tablist">
                    {NOTIF_TABS.map(t => (
                      <button key={t.key} role="tab" aria-selected={notifTab === t.key} className={notifTab === t.key ? 'on' : ''} onClick={() => setNotifTab(t.key)}>
                        {t.label}<i>{countFor(t.key)}</i>
                      </button>
                    ))}
                  </div>
                  <div className="gz-notif__list">
                    {dayGroups.map(g => (
                      <div key={g.title}>
                        <div className="gz-notif__day">{g.title}</div>
                        <div className="gz-notif__items">
                          {g.items.map(({ n, kind }) => (
                            <div key={n.id} className={`gz-n ${n.isRead ? '' : 'unread'}`} onClick={() => markRead(n)}>
                              <span className={`gz-n__ico gz-tone--${kind.cls}`}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={kind.d} /></svg>
                              </span>
                              <span className="gz-n__body">
                                <span className="gz-n__row">
                                  <span className="gz-n__title">{n.title}</span>
                                  {!n.isRead && <span className="gz-n__dot" />}
                                </span>
                                <span className="gz-n__text">{stripFcmMeta(n.content)}</span>
                                <span className="gz-n__meta">
                                  <span>{relTime(n.createdAt)}</span>
                                  <span className={`gz-tag gz-pill--${kind.cls}`}>{kind.tag}</span>
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {dayGroups.length === 0 && <div className="gz-notif__empty">No notifications yet</div>}
                  </div>
                  {pushAvailable && (
                    <div className="gz-notif__foot">
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b>Push notifications</b>
                        <span>Alerts even when the app is closed</span>
                      </span>
                      <button role="switch" aria-checked={pushOn} aria-label="Push notifications" className={`gz-switch ${pushOn ? 'on' : ''}`} onClick={() => onPushChange(!pushOn)}>
                        <i />
                      </button>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
