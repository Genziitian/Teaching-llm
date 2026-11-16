'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import TourOverlay from './TourOverlay'
import { TourStep, WEB_TOUR_STEPS, CAPACITOR_TOUR_STEPS, CURRENT_TOUR_VERSION } from './tourSteps'

interface TourContextType {
  tourActive: boolean
  currentStepIndex: number
  isManualReplay: boolean
  platform: 'WEB' | 'CAPACITOR'
  startManualTour: () => void
  skipTour: () => void
}

const TourContext = createContext<TourContextType | null>(null)

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() || ''
  
  const { data: userData } = useSWR('/api/auth/me', (url: string) => fetch(url).then(r => r.json()), {
    revalidateOnFocus: false,
  })
  const user = userData?.user

  const [platform, setPlatform] = useState<'WEB' | 'CAPACITOR'>('WEB')
  const [tourActive, setTourActive] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isManualReplay, setIsManualReplay] = useState(false)
  const [showSkipModal, setShowSkipModal] = useState(false)
  const [steps, setSteps] = useState<TourStep[]>(WEB_TOUR_STEPS)

  // Prevents auto-start from re-triggering during the current session
  const sessionDismissedRef = useRef(false)

  // Detect platform (Capacitor vs Web)
  useEffect(() => {
    const detectPlatform = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (Capacitor.isNativePlatform()) {
          setPlatform('CAPACITOR')
          setSteps(CAPACITOR_TOUR_STEPS)
        } else {
          setPlatform('WEB')
          setSteps(WEB_TOUR_STEPS)
        }
      } catch (_) {
        setPlatform('WEB')
        setSteps(WEB_TOUR_STEPS)
      }
    }
    detectPlatform()
  }, [])

  // Auto-Start Check for First-Time Users
  useEffect(() => {
    if (!user || tourActive || sessionDismissedRef.current) return

    // Check localStorage fallback for instant client-side persistence
    const localCompleted = typeof window !== 'undefined' && localStorage.getItem('app_tour_completed_v1') === 'true'
    if (localCompleted) {
      sessionDismissedRef.current = true
      return
    }

    // Do NOT auto-start if user is in restricted/special state
    if (
      user.isTerminated ||
      user.deletionRequestedAt ||
      user.needsIdentitySetup ||
      !user.isProfileComplete
    ) {
      return
    }

    // Auto-start eligibility
    const isCompleted = user.appTourCompleted
    const completedVersion = user.completedTourVersion || 0

    if (isCompleted || completedVersion >= CURRENT_TOUR_VERSION) {
      sessionDismissedRef.current = true
      return
    }

    // Only auto-start on Dashboard page after UI render delay
    if (pathname === '/dashboard') {
      const timer = setTimeout(() => {
        if (!sessionDismissedRef.current) {
          setIsManualReplay(false)
          setCurrentStepIndex(0)
          setTourActive(true)
        }
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [user, pathname, tourActive])

  // Handle current step navigation & target visibility
  useEffect(() => {
    if (!tourActive || steps.length === 0) return

    const currentStep = steps[currentStepIndex]
    if (!currentStep) return

    // Handle cross-page navigation if target page is different
    if (currentStep.route && pathname !== currentStep.route) {
      router.push(currentStep.route)
    }

    // Polling to wait for element render in DOM & scroll into view
    let attempts = 0
    const checkTarget = setInterval(() => {
      attempts++
      const el = document.querySelector(currentStep.targetSelector)
      if (el) {
        clearInterval(checkTarget)
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      } else if (attempts > 8) {
        clearInterval(checkTarget)
        // If optional step & element missing, skip to next step
        if (currentStep.optional) {
          if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1)
          } else {
            handleFinish()
          }
        }
      }
    }, 250)

    return () => clearInterval(checkTarget)
  }, [tourActive, currentStepIndex, steps, pathname, router])

  const sendCompletionToBackend = async (skipped = false) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_tour_completed_v1', 'true')
      }
      sessionDismissedRef.current = true

      await fetch('/api/user/tour-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipped, version: CURRENT_TOUR_VERSION }),
      })

      mutate('/api/auth/me')
      mutate('/api/user/tour-status')
    } catch (e) {
      console.error('Failed to sync tour status:', e)
    }
  }

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1)
    } else {
      handleFinish()
    }
  }

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1)
    }
  }

  const handleFinish = () => {
    setTourActive(false)
    setShowSkipModal(false)
    sessionDismissedRef.current = true
    if (!isManualReplay) {
      sendCompletionToBackend(false)
    }
  }

  const handleConfirmSkip = () => {
    setTourActive(false)
    setShowSkipModal(false)
    sessionDismissedRef.current = true
    if (!isManualReplay) {
      sendCompletionToBackend(true)
    }
  }

  const startManualTour = useCallback(() => {
    setIsManualReplay(true)
    setCurrentStepIndex(0)
    setShowSkipModal(false)
    if (pathname !== '/dashboard') {
      router.push('/dashboard')
      setTimeout(() => {
        setTourActive(true)
      }, 600)
    } else {
      setTourActive(true)
    }
  }, [pathname, router])

  const currentStep = steps[currentStepIndex] || null

  return (
    <TourContext.Provider
      value={{
        tourActive,
        currentStepIndex,
        isManualReplay,
        platform,
        startManualTour,
        skipTour: () => setShowSkipModal(true),
      }}
    >
      {children}

      <TourOverlay
        active={tourActive && !showSkipModal}
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={steps.length}
        isManualReplay={isManualReplay}
        onNext={handleNext}
        onBack={handleBack}
        onSkipRequest={() => setShowSkipModal(true)}
        onFinish={handleFinish}
      />

      {/* Skip Confirmation Modal */}
      {showSkipModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100000,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--surface, #ffffff)',
              color: 'var(--text-primary, #0f172a)',
              borderRadius: '14px',
              padding: '24px',
              maxWidth: '360px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--surface-2, #f1f5f9)',
                color: 'var(--primary, #4f46e5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px' }}>Skip App Tour?</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', marginBottom: '24px', lineHeight: '1.45' }}>
              You can replay the tour anytime from Settings / More.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowSkipModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '12px',
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'var(--surface-2, #f8fafc)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #334155)',
                  cursor: 'pointer',
                }}
              >
                Continue Tour
              </button>
              <button
                type="button"
                onClick={handleConfirmSkip}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--primary, #4f46e5)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(128, 128, 128, 0.3)',
                }}
              >
                Skip Tour
              </button>
            </div>
          </div>
        </div>
      )}
    </TourContext.Provider>
  )
}

export function useTour() {
  const context = useContext(TourContext)
  if (!context) {
    throw new Error('useTour must be used within a TourProvider')
  }
  return context
}
