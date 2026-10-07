'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import useSWR from 'swr'
import UserAvatar from '@/components/UserAvatar'
import { clearSWRCache } from '@/lib/cache'
import { useTour } from '@/components/tour/TourContext'

interface MenuItem {
  href: string
  label: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  external?: boolean
}

const ChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9999b0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

function MenuRow({ item, onClick }: { item: MenuItem; onClick?: () => void }) {
  const content = (
    <>
      <div style={{
        width: '38px', height: '38px', borderRadius: '12px', flexShrink: 0,
        background: item.iconBg, color: item.iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {item.icon}
      </div>
      <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
        {item.label}
      </span>
      {item.external ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9999b0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
        </svg>
      ) : (
        <ChevronRight />
      )}
    </>
  )
  const baseStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '14px 16px', borderRadius: '18px',
    background: 'var(--surface-2)',
    boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
    textDecoration: 'none', color: 'var(--text-primary)',
    fontFamily: 'inherit', border: 'none', width: '100%', cursor: 'pointer',
    transition: 'box-shadow 0.15s ease',
    textAlign: 'left',
  }
  if (onClick) return <button onClick={onClick} style={baseStyle}>{content}</button>
  if (item.external) return <a href={item.href} target="_blank" rel="noopener noreferrer" style={baseStyle}>{content}</a>
  return <Link href={item.href} style={baseStyle}>{content}</Link>
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)',
      letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '0 6px', margin: '14px 0 8px',
    }}>{children}</div>
  )
}

export default function MobileMenuPage() {
  const router = useRouter()
  const { startManualTour } = useTour()
  const { data: userData } = useSWR('/api/auth/me', (url: string) => fetch(url).then(r => r.json()), {
    revalidateOnFocus: true,
  })

  const user = userData?.user || userData || {}
  const userName: string = user?.name || 'Guest'
  const userRole: string = (user?.role || 'STUDENT').toString()
  const roleLabel = userRole.charAt(0) + userRole.slice(1).toLowerCase()

  const txHref = userRole === 'STUDENT' ? '/my-transactions' : '/transactions'

  const [appInfo, setAppInfo] = useState<{ version: string; build: string; platform: string } | null>(null)
  const [showDownloadApp, setShowDownloadApp] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        const isNative = Capacitor.isNativePlatform() || document.documentElement.classList.contains('is-native')
        if (!isNative) {
          // Check the device, not viewport width: a resized laptop must stay excluded.
          const browser = navigator as Navigator & { userAgentData?: { mobile?: boolean } }
          const isMobileDevice = browser.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod/i.test(browser.userAgent)
          setShowDownloadApp(isMobileDevice)
          return
        }
        const { App } = await import('@capacitor/app')
        const info = await App.getInfo()
        setAppInfo({
          version: info.version || '—',
          build: info.build || '—',
          platform: Capacitor.getPlatform(),
        })
      } catch (e) { /* web browser — skip */ }
    })()
  }, [])

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

  function handleCheckForUpdates() {
    window.dispatchEvent(new CustomEvent('check-for-app-updates', { detail: { manual: true } }))
  }

  async function handleShareApp() {
    const shareText = `Hey! I recently downloaded the **GenZ IITIAN** app, and honestly it's amazing.

It has everything an IIT Madras BS student needs in one place:
• Free Classes
• PYQs with Solutions
• FREE Notes & PDFs
• Doubt Support
• Guidance from Seniors

You should definitely try it yourself. Download it here:

https://class.genziitian.in/download`

    try {
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share')
        await Share.share({
          title: 'GenZ IITIAN',
          text: shareText,
          dialogTitle: 'Share GenZ IITIAN',
        })
        return
      }
    } catch (e) {
      console.warn('Native share failed, falling back to Web Share:', e)
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'GenZ IITIAN',
          text: shareText,
          url: 'https://class.genziitian.in/download',
        })
      } else {
        await navigator.clipboard.writeText(shareText)
        alert('Share message and download link copied to clipboard!')
      }
    } catch (error) {
      console.error('Error sharing:', error)
      try {
        await navigator.clipboard.writeText(shareText)
        alert('Share message and download link copied to clipboard!')
      } catch (clipErr) {
        alert('Failed to share. Download URL: https://class.genziitian.in/download')
      }
    }
  }

  const shareAppItem: MenuItem = {
    href: '#',
    label: 'Share App',
    iconBg: 'rgba(54, 54, 232, 0.10)',
    iconColor: 'var(--primary)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3"/>
        <circle cx="6" cy="12" r="3"/>
        <circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    ),
  }

  const updateMenuItem: MenuItem = {
    href: '#',
    label: 'Check for Updates',
    iconBg: 'rgba(56, 189, 248, 0.12)',
    iconColor: '#0284c7',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  }

  const downloadAppItem: MenuItem = {
    href: '/download',
    label: 'Download App',
    iconBg: 'rgba(16, 185, 129, 0.10)',
    iconColor: 'var(--success)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  }

  const generalItems: MenuItem[] = [
    {
      href: '/free-resources',
      label: 'Free Resources',
      iconBg: 'rgba(99, 102, 241, 0.12)', iconColor: 'var(--accent)',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    },
    {
      href: txHref,
      label: 'Transactions',
      iconBg: 'rgba(54, 54, 232, 0.10)', iconColor: 'var(--primary)',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    },
    ...((userRole === 'ADMIN' || userRole === 'MODERATOR') ? [] : [{
      href: '/support',
      label: 'Support',
      iconBg: 'rgba(16, 185, 129, 0.10)', iconColor: 'var(--success)',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    }]),
    {
      href: '/settings',
      label: 'Settings',
      iconBg: 'rgba(107, 107, 138, 0.10)', iconColor: 'var(--text-secondary)',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    },
    {
      href: '/dashboard',
      label: 'Take App Tour',
      iconBg: 'rgba(79, 70, 229, 0.12)', iconColor: 'var(--primary)',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
    },
  ]

  const infoItems: MenuItem[] = [
    {
      href: '/company/about-us',
      label: 'About Us',
      iconBg: 'rgba(99, 102, 241, 0.10)', iconColor: 'var(--accent)',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
    },
    {
      href: '/company/privacy-policy',
      label: 'Privacy Policy',
      iconBg: 'rgba(14, 165, 233, 0.10)', iconColor: 'var(--info)',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    },
    {
      href: '/company/terms-and-conditions',
      label: 'Terms & Conditions',
      iconBg: 'rgba(168, 85, 247, 0.10)', iconColor: 'var(--accent)',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>,
    },
    {
      href: '/company/refund-policy',
      label: 'Refund Policy',
      iconBg: 'rgba(244, 63, 94, 0.10)', iconColor: 'var(--danger)',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
    },
  ]

  const socialItems: MenuItem[] = [
    {
      href: 'https://www.instagram.com/genz_iitian/',
      label: 'Instagram',
      external: true,
      iconBg: 'linear-gradient(135deg, #f09433, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888)',
      iconColor: '#ffffff',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
    },
    {
      href: 'https://www.youtube.com/@Gen-ZIITian/videos',
      label: 'YouTube',
      external: true,
      iconBg: 'rgba(255, 0, 0, 0.10)', iconColor: '#ff0000',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
    },
    {
      href: 'https://www.linkedin.com/company/genz-iitian',
      label: 'LinkedIn',
      external: true,
      iconBg: 'rgba(10, 102, 194, 0.10)', iconColor: '#0a66c2',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.78C.8 0 0 .78 0 1.74v20.52C0 23.22.8 24 1.78 24h20.44C23.2 24 24 23.22 24 22.26V1.74C24 .78 23.2 0 22.22 0z"/></svg>,
    },
    {
      href: 'https://t.me/IIT_madras_Resources',
      label: 'Telegram',
      external: true,
      iconBg: 'rgba(34, 158, 217, 0.10)', iconColor: '#229ed9',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.022c.242-.213-.054-.334-.373-.121L8.48 13.5l-2.94-.918c-.64-.203-.658-.64.135-.945l11.494-4.435c.538-.196 1.006.128.825.945z"/></svg>,
    },
  ]

  return (
    <div className="page-container fade-in mobile-menu-page" style={{ paddingBottom: '24px' }}>
      {/* User info hero card */}
      <Link href="/profile" style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '18px 18px',
        borderRadius: '24px',
        background: 'linear-gradient(135deg, #3636e8, #6366f1)',
        boxShadow: '6px 6px 16px rgba(54,54,232,0.25), -6px -6px 14px var(--neu-light)',
        textDecoration: 'none', color: '#fff',
        marginBottom: '6px',
      }}>
        <UserAvatar user={user} size={54} style={{ border: '2px solid rgba(255,255,255,0.3)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: 800, lineHeight: 1.2, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userName}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.85, fontWeight: 600 }}>
            {roleLabel} · View Profile
          </div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>

      <SectionHeader>General</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {generalItems.map(item => (
          <MenuRow
            key={item.label}
            item={item}
            onClick={item.label === 'Take App Tour' ? () => startManualTour() : undefined}
          />
        ))}
        <MenuRow item={shareAppItem} onClick={handleShareApp} />
        {showDownloadApp && <MenuRow item={downloadAppItem} />}
        <MenuRow item={updateMenuItem} onClick={handleCheckForUpdates} />
      </div>

      <SectionHeader>Information</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {infoItems.map(item => <MenuRow key={item.href} item={item} />)}
      </div>

      <SectionHeader>Social</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {socialItems.map(item => <MenuRow key={item.href} item={item} />)}
      </div>

      {/* App Info Card — only visible inside the native Android app */}
      {appInfo && (
        <>
          <SectionHeader>App Info</SectionHeader>
          <div style={{
            padding: '18px 20px', borderRadius: '18px',
            background: 'var(--surface-2)',
            boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>App Version</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>v{appInfo.version}</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Build Number</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>{appInfo.build}</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Platform</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{appInfo.platform}</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Package</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>com.teaching.lms</span>
              </div>
            </div>
          </div>
        </>
      )}

      <SectionHeader>Session</SectionHeader>
      <button onClick={handleLogout} style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '14px 16px', borderRadius: '18px',
        background: 'var(--surface-2)',
        boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
        border: 'none', width: '100%', cursor: 'pointer',
        fontFamily: 'inherit', color: 'var(--danger)',
      }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '12px', flexShrink: 0,
          background: 'rgba(239, 68, 68, 0.10)', color: 'var(--danger)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
        <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, textAlign: 'left' }}>Sign Out</span>
      </button>
    </div>
  )
}
