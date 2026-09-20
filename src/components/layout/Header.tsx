'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useUserData } from '@/components/UserDataProvider'
import UserAvatar from '@/components/UserAvatar'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { clearSWRCache } from '@/lib/cache'
import { useTheme } from '@/components/ThemeProvider'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      style={{
        width: '40px', height: '22px', borderRadius: '11px', flexShrink: 0,
        background: checked ? 'var(--primary)' : 'var(--neu-dark)',
        boxShadow: checked
          ? 'inset 1px 1px 3px rgba(0,0,0,0.2)'
          : 'inset 1px 1px 3px var(--neu-dark)',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.25s ease',
      }}
    >
      <div style={{
        position: 'absolute',
        top: '3px',
        left: checked ? '21px' : '3px',
        width: '16px', height: '16px', borderRadius: '50%',
        background: 'var(--surface)',
        boxShadow: '1px 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.25s ease',
      }} />
    </div>
  )
}

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
  '/free-resources/courses': { title: 'Free Courses', subtitle: 'Browse and self-enroll in free courses' },
  '/free-resources/materials': { title: 'Free Materials', subtitle: 'Download study materials available for free' },
  '/free-resources': { title: 'Free Resources', subtitle: 'Access free courses and study materials' },
  '/transactions': { title: 'Upgrade Transactions', subtitle: 'Monitor student course upgrades and revenue' },
  '/my-transactions': { title: 'My Transaction History', subtitle: 'View all your course transactions and upgrades' },
}

const TYPE_COLORS: Record<string, string> = {
  INFO: 'var(--info)', SUCCESS: 'var(--success)', WARNING: 'var(--warning)', ERROR: 'var(--danger)',
  info: 'var(--info)', success: 'var(--success)', warning: 'var(--warning)', error: 'var(--danger)',
}

export default function Header({ userName, userRole }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  // const [notifications, setNotifications] = useState<Notification[]>([]) - Removed in favor of SWR
  const [showNotif, setShowNotif] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

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
      'home-slides': { title: 'Home Carousel Banners', subtitle: 'Manage promotional slides shown on student dashboard' },
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
        heading: 'Good Morning',
        subtext: 'Hope you’re ready for a productive day ahead.'
      }
    }
    if (hour >= 12 && hour < 17) {
      return {
        heading: 'Good Afternoon',
        subtext: 'Keep going strong, you’re making great progress.'
      }
    }
    if (hour >= 17 && hour < 21) {
      return {
        heading: 'Good Evening',
        subtext: 'Take a moment to relax and review your day.'
      }
    }
    return {
      heading: 'Good Night',
      subtext: 'You’ve done well today. Get some good rest.'
    }
  }

  // const [notifications, setNotifications] = useState<Notification[]>([]) - Removed

  const initials = currentUserName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

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
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
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

  async function markAllRead() {
    await Promise.all(
      notifications.filter(n => !n.isRead).map(n =>
        fetch(`/api/notifications/${n.id}`, { method: 'PUT' })
      )
    )
    mutateNotifications()
  }

  async function handleLogout() {
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

  const neuIconStyle = {
    width: '40px', height: '40px', borderRadius: '50%',
    background: 'var(--sidebar-bg)',
    boxShadow: 'var(--shadow)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-secondary)', cursor: 'pointer',
    transition: 'box-shadow 0.2s ease', border: 'none', flexShrink: 0,
    outline: 'none',
  } as React.CSSProperties

  const firstName = currentUserName.split(' ')[0]
  const isHomePage = pathname === '/dashboard'

  return (
    <header style={{
      height: showGreetingHeadline ? '140px' : '96px', background: 'var(--bg)',
      display: 'flex', justifyContent: 'center',
      position: 'sticky', top: 0, zIndex: 50,
      transition: 'height 0.3s ease',
      padding: '0 24px',
    }} className={`dashboard-header ${!isHomePage ? 'mobile-hide-header' : ''}`}>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: 0,
      }} className="header-inner-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, flex: 1 }} className="header-left-section">
        {/* Hamburger Menu Toggle Button on Mobile (hidden — bottom nav handles navigation) */}
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

        {/* Mobile-only greeting block (profile avatar + welcome text) */}
        {isHomePage && (
          <a href="/profile" className="mobile-header-greeting" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <UserAvatar user={currentAvatarUser} size={44} style={{ border: '2px solid var(--neu-light)' }} />
            <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1, fontFamily: "'Outfit', 'Nunito', sans-serif", letterSpacing: '-0.2px', display: 'flex', alignItems: 'baseline', gap: '5px', flexWrap: 'nowrap' }}>
                {mounted ? getGreeting().heading : 'Welcome'},
                <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Outfit', 'Nunito', sans-serif" }}>
                  {firstName}
                </span>
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.3, marginTop: '3px', fontFamily: "'Outfit', 'Nunito', sans-serif" }}>
                {mounted ? getGreeting().subtext : 'Loading your dashboard...'}
              </span>
            </div>
          </a>
        )}

        {/* Mobile-only title (shown on non-home pages) */}
        {!isHomePage && (
          <div className="mobile-header-back-title" style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Outfit', 'Nunito', sans-serif", letterSpacing: '-0.3px' }}>
              {pageInfo.title}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: showGreetingHeadline ? 'flex-start' : 'center' }} className={`header-titles ${showGreetingHeadline ? 'header-titles-dashboard' : ''}`}>
        {showGreetingHeadline ? (
          <>
            <h1 style={{
              fontSize: 'clamp(38px, 4vw, 48px)',
              fontWeight: '900',
              color: 'var(--text-primary)',
              lineHeight: '1.1',
              letterSpacing: '-1.0px',
              fontFamily: "'Outfit', 'Nunito', sans-serif",
              whiteSpace: 'nowrap',
            }}>
              {mounted ? getGreeting().heading : 'Welcome'},{' '}
              <span style={{
                fontSize: 'inherit',
                fontWeight: '700',
                color: 'var(--primary)',
                letterSpacing: '-0.8px',
                opacity: 0.9,
                fontFamily: "'Outfit', 'Nunito', sans-serif"
              }}>
                {firstName}
              </span>
            </h1>
            <p style={{
              fontSize: '16.5px',
              color: 'var(--text-secondary)',
              marginTop: '6px',
              fontWeight: '500',
              letterSpacing: '0.01em',
              maxWidth: '600px',
              lineHeight: '1.5',
              textAlign: 'left'
            }}>
              {mounted ? getGreeting().subtext : 'Loading your dashboard...'}
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.2', letterSpacing: '-0.5px', textAlign: 'center' }}>
              {pageInfo.title}
            </h1>
            {pageInfo.subtitle ? (
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', fontWeight: '500' }}>
                {pageInfo.subtitle}
                {matchedKey === '/courses/explore' && (
                  <a 
                    href="https://app.genziitian.in/courses" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ 
                      color: '#fff', 
                      textDecoration: 'none', 
                      backgroundColor: 'var(--accent)', 
                      padding: '3px 10px', 
                      borderRadius: '6px', 
                      fontWeight: '600', 
                      cursor: 'pointer', 
                      display: 'inline-flex', 
                      alignItems: 'center',
                      transition: 'all 0.2s', 
                      fontSize: '11px',
                      boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2)'
                    }}
                  >
                    Visit Here
                  </a>
                )}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

        {/* Download App Button — links to professional download page */}
        <a
          href="/download"
          target="_blank"
          rel="noopener noreferrer"
          className="download-btn"
          title="Download Android APP"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="download-btn-text">Download App</span>
        </a>

        {/* Appearance Toggle — Dark/Light */}
        <button
          onClick={() => {
            const { resolvedTheme, setTheme } = themeCtx
            setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
          }}
          title={themeCtx.resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="theme-toggle-btn"
          style={{
            width: '38px', height: '38px', borderRadius: '50%',
            border: 'none', cursor: 'pointer',
            background: 'var(--surface)',
            boxShadow: 'var(--shadow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: themeCtx.resolvedTheme === 'dark' ? '#f59e0b' : 'var(--text-secondary)',
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {themeCtx.resolvedTheme === 'dark' ? (
            /* Sun icon */
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.4s ease' }}>
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            /* Moon icon */
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.4s ease' }}>
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {/* Notification bell */}
        <div
          ref={notifRef}
          className="header-notif"
          style={{ position: 'relative' }}
        >
          <button
            style={{ ...neuIconStyle, position: 'relative' }}
            onClick={() => setShowNotif(v => !v)}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow)')}
            title="Notifications & Announcements"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '6px', right: '6px',
                minWidth: '16px', height: '16px', borderRadius: '50%',
                background: 'var(--danger)', border: '2px solid var(--sidebar-bg)',
                fontSize: '9px', fontWeight: '800', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div
              className="notification-dropdown"
              style={{
                position: 'absolute', right: 0, top: 'calc(100% + 10px)',
                width: 'min(340px, calc(100vw - 24px))', borderRadius: '20px',
                background: 'var(--sidebar-bg)', 
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                border: '1px solid var(--border)',
                zIndex: 200, overflow: 'hidden',
              }}
            >
              <div style={{ padding: '14px 18px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid var(--border)' }}>
                <span style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>
                  Notifications {unreadCount > 0 && <span style={{ color: 'var(--primary)' }}>({unreadCount})</span>}
                </span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--primary)', fontWeight: '700', fontFamily: 'inherit' }}>
                    Mark all read
                  </button>
                )}
              </div>
              {(isNativeApp || isSupported) && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--border)',
                  background: 'rgba(54,54,232,0.02)',
                }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Push notifications</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Alerts even when the app is closed
                    </div>
                  </div>
                  <div>
                    {isNativeApp ? (
                      <Toggle 
                        checked={nativeSubscribed} 
                        onChange={async (v) => {
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
                        }} 
                      />
                    ) : (
                      <Toggle 
                        checked={isSubscribed} 
                        onChange={async (v) => {
                          if (v) {
                            if (typeof window !== 'undefined' && window.Notification?.permission === 'denied') {
                              window.dispatchEvent(new CustomEvent('show-push-blocked-modal'))
                              return
                            }
                            await subscribe()
                          } else {
                            await unsubscribe()
                          }
                        }} 
                      />
                    )}
                  </div>
                </div>
              )}
              <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No notifications yet
                  </div>
                ) : notifications.slice(0, 5).map(n => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n)}
                    style={{
                      padding: '12px 18px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border-light)',
                      background: n.isRead ? 'transparent' : 'rgba(54,54,232,0.04)',
                      transition: 'background 0.15s',
                      display: 'flex', gap: '12px', alignItems: 'flex-start',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = n.isRead ? 'transparent' : 'rgba(54,54,232,0.04)')}
                  >
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%', marginTop: '5px', flexShrink: 0,
                      background: n.isRead ? 'var(--text-muted)' : (TYPE_COLORS[n.type] || 'var(--info)'),
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: n.isRead ? '500' : '700', color: 'var(--text-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const cleanText = stripFcmMeta(n.content)
                          return cleanText.length > 60 ? cleanText.slice(0, 57) + '…' : cleanText
                        })()}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {new Date(n.createdAt).toLocaleDateString('en-GB', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User pill with dropdown */}
        <div
          ref={userMenuRef}
          className="header-profile"
          data-tour="web-header-user"
          style={{ position: 'relative' }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 16px 6px 6px', borderRadius: '50px', background: 'var(--sidebar-bg)', boxShadow: 'var(--shadow)', cursor: 'pointer', transition: 'box-shadow 0.2s ease', outline: 'none' }}
            onClick={() => setShowUserMenu(v => !v)}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow)')}
            title="My Account & Profile"
          >
            <UserAvatar user={currentAvatarUser} size={32} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1.2' }}>{currentUserName}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                {currentUserRole.charAt(0) + currentUserRole.slice(1).toLowerCase()}
                {currentUserRole !== 'STUDENT' && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3636e8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9999b0" strokeWidth="2" style={{ marginLeft: '4px' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          {/* User dropdown menu */}
          {showUserMenu && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 10px)',
              width: '200px', borderRadius: '16px',
              background: 'var(--sidebar-bg)', 
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
              border: '1px solid var(--border)',
              zIndex: 200, overflow: 'hidden', padding: '6px',
            }}>
              <button
                onClick={() => { setShowUserMenu(false); router.push('/profile') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '10px 14px', borderRadius: '12px', border: 'none',
                  background: 'transparent', cursor: 'pointer', fontSize: '13px',
                  fontWeight: '500', color: 'var(--text-primary)', fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(54,54,232,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b6b8a" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                My Profile
              </button>
              <button
                onClick={() => { setShowUserMenu(false); router.push('/settings') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '10px 14px', borderRadius: '12px', border: 'none',
                  background: 'transparent', cursor: 'pointer', fontSize: '13px',
                  fontWeight: '500', color: 'var(--text-primary)', fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(54,54,232,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b6b8a" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Settings
              </button>
              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 10px' }} />
              <button
                onClick={() => { setShowUserMenu(false); handleLogout() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '10px 14px', borderRadius: '12px', border: 'none',
                  background: 'transparent', cursor: 'pointer', fontSize: '13px',
                  fontWeight: '500', color: 'var(--danger)', fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  )
}
