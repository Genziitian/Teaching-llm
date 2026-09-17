'use client'

import { usePostHog } from 'posthog-js/react'
import { useCallback } from 'react'

/**
 * Custom analytics hook - use this throughout your app to track events
 * 
 * Usage:
 *   const { track, identify } = useAnalytics()
 *   track('video_played', { courseId: '123', videoTitle: 'Intro to Physics' })
 */
export function useAnalytics() {
  const posthog = usePostHog()

  // Identify a user (call this after login)
  const identify = useCallback((userId: string, properties?: {
    name?: string
    email?: string
    role?: string
    batch?: string
    plan?: string
  }) => {
    if (posthog) {
      posthog.identify(userId, properties)
    }
    if (typeof window !== 'undefined' && (window as any).gtag) {
      if (properties) {
        (window as any).gtag('set', 'user_properties', properties)
      }
      (window as any).gtag('config', process.env.NEXT_PUBLIC_GA_ID, {
        user_id: userId,
      })
    }
  }, [posthog])

  // Track any event
  const track = useCallback((event: string, properties?: Record<string, unknown>) => {
    if (posthog) {
      posthog.capture(event, properties)
    }
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event, properties)
    }
  }, [posthog])

  // Reset on logout
  const reset = useCallback(() => {
    if (posthog) {
      posthog.reset()
    }
  }, [posthog])

  return { track, identify, reset }
}

// ============================================================
// PRE-DEFINED EVENTS - Use these for consistency
// ============================================================
export const AnalyticsEvents = {
  // Auth
  USER_SIGNED_UP: 'user_signed_up',
  USER_LOGGED_IN: 'user_logged_in',
  USER_LOGGED_OUT: 'user_logged_out',

  // App
  APP_OPENED: 'app_opened',                    // Tracks who opens the app
  APK_DOWNLOAD_CLICKED: 'apk_download_clicked', // Tracks downloads!

  // Courses
  COURSE_VIEWED: 'course_viewed',
  VIDEO_STARTED: 'video_started',
  VIDEO_COMPLETED: 'video_completed',
  NOTES_DOWNLOADED: 'notes_downloaded',

  // Live Sessions
  LIVE_SESSION_JOINED: 'live_session_joined',
  LIVE_SESSION_LEFT: 'live_session_left',
  LIVE_REMINDER_SET: 'live_reminder_set',

  // Payments
  PAYMENT_INITIATED: 'payment_initiated',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',

  // Engagement
  DOUBT_ASKED: 'doubt_asked',
  ANNOUNCEMENT_VIEWED: 'announcement_viewed',
  NOTIFICATION_CLICKED: 'notification_clicked',
} as const
