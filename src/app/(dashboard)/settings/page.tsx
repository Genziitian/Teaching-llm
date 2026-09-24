'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useTheme } from '@/components/ThemeProvider'
import { DELETION_REASONS } from '@/lib/deletion-reasons'
import { useTour } from '@/components/tour/TourContext'
import { useLanguage } from '@/contexts/LanguageContext'


function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: '46px', height: '26px', borderRadius: '13px', flexShrink: 0,
        background: checked ? 'var(--primary)' : 'var(--neu-dark)',
        boxShadow: checked
          ? 'inset 2px 2px 5px rgba(0,0,0,0.2)'
          : 'inset 2px 2px 4px var(--neu-dark), inset -2px -2px 4px var(--neu-dark)',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.25s ease',
      }}
    >
      <div style={{
        position: 'absolute',
        top: '4px',
        left: checked ? '24px' : '4px',
        width: '18px', height: '18px', borderRadius: '50%',
        background: 'var(--surface)',
        boxShadow: '1px 1px 4px rgba(0,0,0,0.2)',
        transition: 'left 0.25s ease',
      }} />
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { startManualTour } = useTour()
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])


  // Notification preferences (UI state — backend integration ready when needed)
  const [notifEmail, setNotifEmail] = useState(true)
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

  // Theme preference — wired to the real ThemeProvider (persists + applies live)
  const { theme, setTheme } = useTheme()

  // Language preference
  const { language, setLanguage, t } = useLanguage()

  // Global Maintenance Mode (Manager only)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceEndsAt, setMaintenanceEndsAt] = useState('')
  const [isManagerUser, setIsManagerUser] = useState(false)

  // Help Card Config
  const [helpCardConfig, setHelpCardConfig] = useState({ title: '', buttonText: '', redirectUrl: '', isEnabled: true })
  const [savingHelpCard, setSavingHelpCard] = useState(false)

  // Fetch initial settings on mount (strictly for managers)
  useEffect(() => {
    fetch('/api/updates/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.settings) {
          setIsManagerUser(true)
          setMaintenanceMode(data.settings.maintenanceMode || false)
          if (data.settings.maintenanceEndsAt) {
            const dateObj = new Date(data.settings.maintenanceEndsAt)
            const localISO = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
            setMaintenanceEndsAt(localISO)
          } else {
            setMaintenanceEndsAt('')
          }
        }
      })
      .catch(err => console.error('Failed to fetch settings:', err))

    fetch('/api/support/help-card')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setHelpCardConfig({
            title: data.title || '',
            buttonText: data.buttonText || '',
            redirectUrl: data.redirectUrl || '',
            isEnabled: data.isEnabled ?? true,
          })
        }
      })
      .catch(err => console.error('Failed to fetch help card config:', err))

    fetch('/api/user/delete-request')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setDeletionData(data)
      })
      .catch(err => console.error('Failed to fetch deletion status:', err))
  }, [])

  // Account Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteModalStep, setDeleteModalStep] = useState<1 | 2 | 3>(1)
  const [selectedReasonCodes, setSelectedReasonCodes] = useState<string[]>([])
  const [userFeedbackComment, setUserFeedbackComment] = useState('')
  const [agreeDeleteTerms, setAgreeDeleteTerms] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deletionData, setDeletionData] = useState<any | null>(null)
  const [cancellingDeletion, setCancellingDeletion] = useState(false)
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false)
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState('')
  const [timeRemainingStr, setTimeRemainingStr] = useState<string>('')

  // Live Countdown effect for active deletion request
  useEffect(() => {
    if (!deletionData?.hasRequested || !deletionData?.request?.cancelUntil) {
      setTimeRemainingStr('')
      return
    }

    function updateCountdown() {
      const deadline = new Date(deletionData.request.cancelUntil).getTime()
      const now = Date.now()
      const diff = deadline - now

      if (diff <= 0) {
        setTimeRemainingStr('Cancellation period expired')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setTimeRemainingStr(`${hours}h ${minutes}m ${seconds}s remaining to cancel`)
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [deletionData])

  function openDeletionFlow() {
    setDeleteModalStep(1)
    setSelectedReasonCodes([])
    setUserFeedbackComment('')
    setAgreeDeleteTerms(false)
    setShowDeleteModal(true)
  }

  function toggleReasonCode(code: string) {
    setSelectedReasonCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  async function handleDeleteAccountSubmit() {
    if (selectedReasonCodes.length === 0 || !agreeDeleteTerms) return
    setIsDeletingAccount(true)
    try {
      const res = await fetch('/api/user/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reasonCodes: selectedReasonCodes,
          reasonCode: selectedReasonCodes.join(','),
          userComment: userFeedbackComment,
          agreeTerms: true,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        // Refresh deletion data
        const refreshRes = await fetch('/api/user/delete-request')
        const refreshData = await refreshRes.json()
        setDeletionData(refreshData)
        setShowDeleteModal(false)
        setDeleteSuccessMessage(data.message || 'Your account deletion request has been submitted.')
        setTimeout(() => setDeleteSuccessMessage(''), 8000)
      } else {
        alert(data.error || 'Failed to submit account deletion request')
      }
    } catch (err) {
      console.error(err)
      alert('An error occurred while submitting your request')
    } finally {
      setIsDeletingAccount(false)
    }
  }

  async function handleConfirmCancelDeletion() {
    setCancellingDeletion(true)
    try {
      const res = await fetch('/api/user/delete-request', {
        method: 'DELETE',
      })
      if (res.ok) {
        // Refresh deletion data
        const refreshRes = await fetch('/api/user/delete-request')
        const refreshData = await refreshRes.json()
        setDeletionData(refreshData)
        setShowCancelConfirmModal(false)
        setDeleteSuccessMessage('Your account deletion request has been cancelled. Your account is active.')
        setTimeout(() => setDeleteSuccessMessage(''), 6000)
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to cancel request')
      }
    } catch (err) {
      console.error(err)
      alert('An error occurred while cancelling your request')
    } finally {
      setCancellingDeletion(false)
    }
  }

  async function handleToggleMaintenance(val: boolean) {
    setMaintenanceMode(val)
    try {
      await fetch('/api/updates/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          maintenanceMode: val,
          ...(!val && { maintenanceEndsAt: null })
        }),
      })
      if (!val) {
        setMaintenanceEndsAt('')
      }
    } catch (err) {
      console.error('Failed to update maintenance mode:', err)
      setMaintenanceMode(!val) // revert on error
    }
  }

  async function handleUpdateEndsAt(dateStr: string) {
    setMaintenanceEndsAt(dateStr)
    const isoString = dateStr ? new Date(dateStr).toISOString() : null
    try {
      await fetch('/api/updates/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          maintenanceMode: true,
          maintenanceEndsAt: isoString
        }),
      })
    } catch (err) {
      console.error('Failed to update maintenance end time:', err)
    }
  }

  async function handleSaveHelpCard() {
    setSavingHelpCard(true)
    try {
      const res = await fetch('/api/support/help-card', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(helpCardConfig),
      })
      if (res.ok) alert('Support card settings saved successfully')
      else alert('Failed to save settings')
    } catch {
      alert('Something went wrong')
    }
    setSavingHelpCard(false)
  }


  const insetRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: isMobile ? '12px 14px' : '14px 18px', borderRadius: '14px', background: 'var(--surface-2)',
    boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
    gap: '12px',
  }


  return (
    <div className="page-container fade-in" style={{ padding: isMobile ? '12px' : '20px' }}>
      <style>{`
        .mobile-back-header {
          display: none !important;
        }
        .desktop-back-container {
          display: block;
        }
        @media (max-width: 767px) {
          .mobile-back-header {
            display: flex !important;
          }
          .desktop-back-container {
            display: none !important;
          }
          .page-container {
            padding: 16px 14px 24px !important;
          }
        }
      `}</style>
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Mobile-only Header with Back Button */}
        <div className="mobile-back-header" style={{
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          padding: '8px 4px 16px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}>
          <button
            onClick={() => router.back()}
            style={{
              background: 'var(--surface-2)',
              boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
              border: 'none',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              transition: 'transform 0.15s ease',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div>
            <span style={{ display: 'block', fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', 'Nunito', sans-serif", letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              Settings
            </span>
            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {t('settings.subtitle')}
            </span>
          </div>
        </div>

        {/* ── Back ── */}
        <div className="desktop-back-container">
          <button
            onClick={() => router.back()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', borderRadius: '50px',
              background: 'var(--surface-2)', border: 'none', cursor: 'pointer',
              boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
              fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>
        </div>


        {/* ── Notifications + Preferences (side by side) ── */}
        <div className="responsive-two-column-grid">

          {/* ── Notifications ── */}
          <div className="card" style={{ padding: isMobile ? '16px' : '28px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3636e8" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              Notifications
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>{t('settings.notifications.desc')}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                {/* Regular Toggles */}
                <div style={insetRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)' }}>Email {t('settings.notifications.title')}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{t('settings.notifications.emailDesc')}</div>
                  </div>
                  <Toggle checked={notifEmail} onChange={setNotifEmail} />
                </div>

                {/* Push Notification Toggle (Web vs Native) */}
                {isNativeApp ? (
                  <div style={insetRow}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)' }}>App Push {t('settings.notifications.title')}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{t('settings.notifications.appPushDesc')}</div>
                    </div>
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
                  </div>
                ) : (
                  isSupported && (
                    <div style={insetRow}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)' }}>{t('settings.notifications.browserPush')}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{t('settings.notifications.browserPushDesc')}</div>
                      </div>
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
                    </div>
                  )
                )}
              </div>
          </div>

          {/* ── Preferences ── */}
          <div className="card" style={{ padding: isMobile ? '16px' : '28px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3636e8" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Preferences
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>{t('settings.preferences.desc')}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {/* Theme Mode */}
              <div style={insetRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)' }}>{t('settings.preferences.themeMode')}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{t('settings.preferences.themeDesc')}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {(['light', 'dark', 'black', 'system'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      style={{
                        padding: '7px 14px', borderRadius: '50px', border: 'none',
                        fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                        background: theme === t ? 'var(--button-background, var(--primary))' : 'var(--surface-2)',
                        color: theme === t ? 'var(--button-text, #ffffff)' : 'var(--text-secondary)',
                        boxShadow: theme === t
                          ? '3px 3px 7px rgba(0,0,0,0.35), -1px -1px 4px var(--neu-glow)'
                          : '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div style={insetRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)' }}>{t('settings.preferences.language')}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{t('settings.preferences.languageDesc')}</div>
                </div>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value as 'en' | 'hi')}
                  style={{
                    padding: '7px 12px', borderRadius: '50px', border: 'none',
                    fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                    background: 'var(--surface-2)', color: 'var(--text-primary)', fontFamily: 'inherit',
                    boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
                    outline: 'none', appearance: 'auto', flexShrink: 0,
                  }}
                >
                  <option value="en">English</option>
                  
                  <option value="hi">Hindi</option>
                </select>
              </div>

              {/* Guidance / Take App Tour */}
              <div style={insetRow} data-tour="settings-replay-card">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)' }}>{t('settings.preferences.takeTour')}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{t('settings.preferences.takeTourDesc')}</div>
                </div>
                <button
                  type="button"
                  onClick={() => startManualTour()}
                  style={{
                    padding: '7px 14px', borderRadius: '50px', border: 'none',
                    fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                    background: 'var(--primary)', color: '#ffffff',
                    boxShadow: '3px 3px 7px rgba(54,54,232,0.35)',
                    transition: 'all 0.2s ease', flexShrink: 0,
                  }}
                >
                  Start Tour
                </button>
              </div>

              {/* Maintenance Mode - Only visible for Managers */}
              {isManagerUser && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                  <div style={{
                    ...insetRow,
                    background: maintenanceMode ? 'var(--danger-light)' : 'var(--surface-2)',
                    transition: 'background 0.3s ease',
                    border: maintenanceMode ? '1px solid #fda4af' : '1px solid transparent'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', color: maintenanceMode ? '#be123c' : 'var(--text-primary)' }}>
                        Maintenance Mode
                      </div>
                      <div style={{ fontSize: '12px', color: maintenanceMode ? 'var(--danger)' : 'var(--text-muted)', marginTop: '2px' }}>
                        {t('settings.preferences.maintenanceDesc')}
                      </div>
                    </div>
                    <Toggle checked={maintenanceMode} onChange={handleToggleMaintenance} />
                  </div>
                  
                  {maintenanceMode && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      background: 'var(--surface)',
                      padding: '14px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      marginTop: '-4px'
                    }}>
                      <label style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Expected Return Time (Optional)
                      </label>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                          type="datetime-local"
                          value={maintenanceEndsAt}
                          onChange={(e) => handleUpdateEndsAt(e.target.value)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            fontSize: '13px',
                            background: 'var(--bg)',
                            color: 'var(--text-primary)',
                            fontFamily: 'inherit',
                            outline: 'none',
                            flex: 1
                          }}
                        />
                        {maintenanceEndsAt && (
                          <button
                            onClick={() => handleUpdateEndsAt('')}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'var(--surface-2)',
                              color: 'var(--text-secondary)',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Leave blank to show "We'll be back shortly" instead of a countdown timer.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Help Card Settings (Manager only) ── */}
        {isManagerUser && (
          <div className="card" style={{ padding: isMobile ? '16px' : '28px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3636e8" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <path d="M12 8v8"/><path d="M8 12h8"/>
              </svg>
              Course List Add Settings (Manager Only)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>Configure the simple fake course card at the end of the list.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              <div style={insetRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)' }}>Enable Card</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Show this block in the courses section</div>
                </div>
                <Toggle
                  checked={helpCardConfig.isEnabled}
                  onChange={(v) => setHelpCardConfig(p => ({ ...p, isEnabled: v }))}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>Card Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={helpCardConfig.title}
                    onChange={e => setHelpCardConfig(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Join the Community"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'none' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>CTA Button Text</label>
                  <input
                    type="text"
                    className="form-input"
                    value={helpCardConfig.buttonText}
                    onChange={e => setHelpCardConfig(p => ({ ...p, buttonText: e.target.value }))}
                    placeholder="e.g. Enroll Now"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'none' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>Redirect URL</label>
                  <input
                    type="text"
                    className="form-input"
                    value={helpCardConfig.redirectUrl}
                    onChange={e => setHelpCardConfig(p => ({ ...p, redirectUrl: e.target.value }))}
                    placeholder="https://..."
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button onClick={handleSaveHelpCard} disabled={savingHelpCard} className="btn btn-primary" style={{ background: 'var(--primary)', color: 'white' }}>
                  {savingHelpCard ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Danger Zone: Account Deletion ── */}
        <div className="card" style={{ padding: isMobile ? '16px' : '28px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--danger, #ef4444)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Danger Zone
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>
            {t('settings.dangerZone.desc')}
          </p>

          {deleteSuccessMessage && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: 'var(--success, #22c55e)',
              fontSize: '13px',
              fontWeight: '500',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {deleteSuccessMessage}
            </div>
          )}

          {deletionData?.hasRequested && deletionData?.request ? (
            <div style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1.5px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: deletionData.request.status === 'APPROVED' ? '#3b82f6' : '#ef4444',
                    }} />
                    <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {deletionData.request.status === 'APPROVED'
                        ? 'Manager Accepted Deletion Request'
                        : 'Account Deletion Request Active'}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
                    {deletionData.request.status === 'APPROVED'
                      ? 'Manager has accepted your deletion request. Deletion will proceed after the 24-hour window expires.'
                      : 'Your request has been received. You have a 24-hour window to cancel.'}
                  </p>
                </div>

                {deletionData.request.isCancellationEligible && (
                  <button
                    onClick={() => setShowCancelConfirmModal(true)}
                    disabled={cancellingDeletion}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '10px',
                      border: '1.5px solid rgba(239, 68, 68, 0.4)',
                      background: 'var(--surface)',
                      color: '#ef4444',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: cancellingDeletion ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cancellingDeletion ? 'Cancelling...' : 'Cancel Deletion Request'}
                  </button>
                )}
              </div>

              {/* Countdown Bar */}
              {deletionData.request.isCancellationEligible ? (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: '10px',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '16px' }}>⏳</span>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#d97706' }}>
                    {timeRemainingStr || 'Calculating remaining time...'}
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--surface-2)',
                  borderRadius: '10px',
                  fontSize: '12.5px',
                  color: 'var(--text-muted)'
                }}>
                  Cancellation window closed. Account queued for final deletion processing.
                </div>
              )}

              {/* Reason & Feedback Summary */}
              <div style={{
                background: 'var(--surface-2)',
                padding: '14px',
                borderRadius: '12px',
                fontSize: '13px'
              }}>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                  Reason: <span style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>{deletionData.request.reasonLabel}</span>
                </div>
                {deletionData.request.userComment && (
                  <div style={{ marginTop: '6px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    "{deletionData.request.userComment}"
                  </div>
                )}
              </div>

              {/* Timeline */}
              {deletionData.request.events && deletionData.request.events.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Timeline
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {deletionData.request.events.map((ev: any) => {
                      const label = ev.eventType === 'ACCOUNT_DELETION_REQUESTED'
                        ? 'Account Deletion Requested'
                        : ev.eventType === 'ACCOUNT_DELETION_APPROVED'
                        ? 'Manager Accepted Deletion Request'
                        : ev.eventType === 'ACCOUNT_DELETION_CANCELLED_BY_USER'
                        ? 'Cancelled by User'
                        : ev.eventType === 'ACCOUNT_DELETION_CANCELLED_BY_MANAGER'
                        ? 'Cancelled by Manager'
                        : ev.eventType === 'ACCOUNT_DELETED'
                        ? 'Account Permanently Deleted'
                        : ev.eventType

                      return (
                        <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: ev.eventType === 'ACCOUNT_DELETION_APPROVED' ? '#3b82f6' : '#ef4444',
                          }} />
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            {label}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>
                            {new Date(ev.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · {new Date(ev.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={insetRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)' }}>Delete Your Account</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Permanently delete your account, course access, and community memberships.
                </div>
              </div>
              <button
                onClick={openDeletionFlow}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--danger, #ef4444)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                  transition: 'opacity 0.2s',
                  flexShrink: 0
                }}
              >
                Delete Your Account
              </button>
            </div>
          )}
        </div>

        {/* ── 3-Step Delete Account Modal ── */}
        {showDeleteModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.2s ease-out',
          }}>
            <div style={{
              background: 'var(--surface)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              maxWidth: '540px',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(239, 68, 68, 0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--danger, #ef4444)',
                    flexShrink: 0
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <div>
                    <h2 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                      Delete Your Account
                    </h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      Step {deleteModalStep} of 3
                    </p>
                  </div>
                </div>

                {/* Step Indicators */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3].map((s) => (
                    <div
                      key={s}
                      style={{
                        width: '24px',
                        height: '6px',
                        borderRadius: '3px',
                        background: deleteModalStep >= s ? 'var(--danger, #ef4444)' : 'var(--border)',
                        transition: 'background 0.2s ease',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {deleteModalStep === 1 && (
                  <>
                    <p style={{ fontSize: '14.5px', color: 'var(--text-primary)', fontWeight: '600', margin: 0 }}>
                      You are about to permanently delete your account from our platform.
                    </p>
                    <div style={{
                      background: 'var(--surface-2)',
                      borderRadius: '14px',
                      padding: '16px',
                      border: '1px solid var(--border-light, var(--border))',
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '10px' }}>
                        Please note:
                      </div>
                      <ul style={{
                        margin: 0,
                        paddingLeft: '20px',
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.6',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <li>Any active subscriptions or course access will be closed.</li>
                        <li>You will be removed from all teams, communities, and communication channels.</li>
                        <li>No refund will be provided for any remaining subscription period or unused access.</li>
                        <li>You will have <strong>24 hours</strong> to cancel this request before final processing.</li>
                      </ul>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                      We’re sorry to see you go. If you are sure you want to proceed, click Continue.
                    </p>
                  </>
                )}

                {deleteModalStep === 2 && (
                  <>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px' }}>
                        Why are you leaving GenZ IITIAN? <span style={{ color: '#ef4444' }}>*</span>
                      </p>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                        Please select all reasons that apply.
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      {DELETION_REASONS.map((r) => {
                        const isChecked = selectedReasonCodes.includes(r.code)
                        return (
                          <label
                            key={r.code}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '12px 14px',
                              borderRadius: '12px',
                              background: isChecked ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface-2)',
                              border: `1.5px solid ${isChecked ? '#ef4444' : 'var(--border)'}`,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <input
                              type="checkbox"
                              name="deletionReason"
                              value={r.code}
                              checked={isChecked}
                              onChange={() => toggleReasonCode(r.code)}
                              style={{ accentColor: '#ef4444', width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '13.5px', fontWeight: isChecked ? '700' : '500', color: 'var(--text-primary)' }}>
                              {r.label}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}

                {deleteModalStep === 3 && (
                  <>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px' }}>
                        Anything you'd like to tell us? <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>(Optional)</span>
                      </p>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                        Your feedback helps us understand what we could improve.
                      </p>
                    </div>

                    <textarea
                      placeholder="Tell us what made you decide to leave..."
                      value={userFeedbackComment}
                      onChange={(e) => setUserFeedbackComment(e.target.value.slice(0, 1000))}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '12px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontSize: '13.5px',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                    <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)', marginTop: '-8px' }}>
                      {userFeedbackComment.length}/1000 characters
                    </div>

                    {/* Summary of reasons */}
                    <div style={{
                      background: 'var(--surface-2)',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      fontSize: '13px'
                    }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Selected Reasons ({selectedReasonCodes.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                        {selectedReasonCodes.map((code) => {
                          const label = DELETION_REASONS.find(r => r.code === code)?.label || code
                          return (
                            <div key={code} style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
                              <span style={{ color: '#ef4444' }}>•</span>
                              <span>{label}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Terms Checkbox */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: agreeDeleteTerms ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface-2)',
                      border: `1.5px solid ${agreeDeleteTerms ? '#ef4444' : 'var(--border)'}`,
                      cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={agreeDeleteTerms}
                        onChange={(e) => setAgreeDeleteTerms(e.target.checked)}
                        style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: '#ef4444' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                        I understand that I have 24 hours to cancel this request before my account is permanently scheduled for deletion.
                      </span>
                    </label>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border)',
                background: 'var(--surface-2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
              }}>
                {deleteModalStep === 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(false)}
                      className="btn btn-ghost"
                      style={{ borderRadius: '10px', fontSize: '13px' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteModalStep(2)}
                      style={{
                        padding: '10px 22px',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#ef4444',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      Continue →
                    </button>
                  </>
                ) : deleteModalStep === 2 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setDeleteModalStep(1)}
                      className="btn btn-ghost"
                      style={{ borderRadius: '10px', fontSize: '13px' }}
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteModalStep(3)}
                      disabled={selectedReasonCodes.length === 0}
                      style={{
                        padding: '10px 22px',
                        borderRadius: '10px',
                        border: 'none',
                        background: selectedReasonCodes.length > 0 ? '#ef4444' : 'var(--border)',
                        color: selectedReasonCodes.length > 0 ? '#fff' : 'var(--text-muted)',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: selectedReasonCodes.length > 0 ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Next →
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setDeleteModalStep(2)}
                      className="btn btn-ghost"
                      style={{ borderRadius: '10px', fontSize: '13px' }}
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccountSubmit}
                      disabled={!agreeDeleteTerms || isDeletingAccount}
                      style={{
                        padding: '10px 22px',
                        borderRadius: '10px',
                        border: 'none',
                        background: agreeDeleteTerms ? '#ef4444' : 'var(--border)',
                        color: agreeDeleteTerms ? '#fff' : 'var(--text-muted)',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: !agreeDeleteTerms || isDeletingAccount ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {isDeletingAccount ? 'Submitting...' : 'Request Account Deletion'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Cancel Confirmation Modal ── */}
        {showCancelConfirmModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}>
            <div style={{
              background: 'var(--surface)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
            }}>
              <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 8px' }}>
                Keep your account?
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 20px' }}>
                Cancelling will stop the current account deletion request and restore full normal account access immediately.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowCancelConfirmModal(false)}
                  className="btn btn-ghost"
                  style={{ borderRadius: '10px', fontSize: '13px' }}
                >
                  Continue With Deletion
                </button>
                <button
                  onClick={handleConfirmCancelDeletion}
                  disabled={cancellingDeletion}
                  className="btn btn-primary"
                  style={{ borderRadius: '10px', fontSize: '13px', padding: '10px 20px' }}
                >
                  {cancellingDeletion ? 'Restoring...' : 'Keep My Account'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
