'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function CapacitorBridge() {
  const router = useRouter()
  const lastBackPressRef = useRef(0)

  useEffect(() => {
    let cleanup: (() => void) | undefined

    ;(async () => {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) return

      const platform = Capacitor.getPlatform()
      document.documentElement.classList.add('is-native')
      document.documentElement.classList.add(`platform-${platform}`)

      const [
        { App },
        { StatusBar, Style },
        { Keyboard, KeyboardResize, KeyboardStyle },
        { PushNotifications },
        { ScreenOrientation }
      ] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/status-bar'),
        import('@capacitor/keyboard'),
        import('@capacitor/push-notifications'),
        import('@capacitor/screen-orientation'),
      ])

      // Status bar follows the app theme (data-theme is set by ThemeProvider /
      // the anti-FOUC script). Style.Dark = light text (for dark bg), Style.Light
      // = dark text (for light bg).
      const applyStatusBarStyles = async () => {
        try {
          const currentTheme = document.documentElement.getAttribute('data-theme')
          const isDarkOrBlack = currentTheme === 'dark' || currentTheme === 'black'
          const barColor = currentTheme === 'black' ? '#000000' : (currentTheme === 'dark' ? '#161a23' : '#e8eaf0')
          await StatusBar.setStyle({ style: isDarkOrBlack ? Style.Dark : Style.Light })
          await StatusBar.setBackgroundColor({ color: barColor })
          try { await Keyboard.setStyle({ style: isDarkOrBlack ? KeyboardStyle.Dark : KeyboardStyle.Light }) } catch {}
        } catch (e) { console.warn('StatusBar style application failed', e) }
      }

      await applyStatusBarStyles()

      // Re-skin the status bar whenever the user switches theme.
      const onThemeChange = () => { applyStatusBarStyles() }
      window.addEventListener('themechange', onThemeChange)

      try {
        await Keyboard.setResizeMode({ mode: KeyboardResize.Body })
      } catch (e) { console.warn('Keyboard setup failed', e) }

      try {
        await ScreenOrientation.lock({ orientation: 'portrait' })
        console.log('[CapacitorBridge] Locked screen orientation to portrait')
      } catch (e) {
        console.warn('ScreenOrientation locking to portrait failed', e)
      }

      const onResizeOrRotate = () => {
        applyStatusBarStyles()
      }
      window.addEventListener('resize', onResizeOrRotate)
      window.addEventListener('orientationchange', onResizeOrRotate)

      const backHandle = await App.addListener('backButton', () => {
        if (window.history.length > 1) {
          router.back()
          return
        }
        const now = Date.now()
        if (now - lastBackPressRef.current < 2000) {
          App.exitApp()
        } else {
          lastBackPressRef.current = now
        }
      })

      const stateHandle = await App.addListener('appStateChange', async (state) => {
        if (state.isActive) {
          await applyStatusBarStyles()
        }
      })

      // Early global push listeners to capture cold boots & foreground alerts
      console.log('[CapacitorBridge] Registering persistent PushNotification listeners...')

      // 🔑 Token refresh listener — FCM periodically rotates device tokens.
      // If we don't catch this, the old token stays in DB and notifications fail silently.
      const registrationHandle = await PushNotifications.addListener('registration', async (token) => {
        console.log('[CapacitorBridge] FCM token (re)issued:', token.value)
        try {
          const saved = localStorage.getItem('last_fcm_token')
          if (saved === token.value) {
            console.log('[CapacitorBridge] Token unchanged — skipping re-registration')
            return
          }
          await fetch('/api/fcm/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token.value, platform: 'ANDROID' }),
          })
          localStorage.setItem('last_fcm_token', token.value)
          console.log('[CapacitorBridge] FCM token refreshed & saved to backend')
        } catch (err) {
          console.error('[CapacitorBridge] Failed to refresh FCM token:', err)
        }
      })

      const receivedHandle = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[CapacitorBridge] "pushNotificationReceived" listener fired in foreground:', JSON.stringify(notification))
      })

      const actionHandle = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[CapacitorBridge] "pushNotificationActionPerformed" listener fired. Action:', JSON.stringify(action))
        let url = action.notification.data?.url
        
        // Handle custom Android CTA button action click
        if (action.actionId === 'open_cta' && action.notification.data?.ctaLink) {
          url = action.notification.data.ctaLink
          console.log('[CapacitorBridge] Custom CTA button clicked. Overriding redirect URL to ctaLink:', url)
        }

        if (url && typeof window !== 'undefined') {
          const baseUrl = 'https://teaching-llm.onrender.com'
          if (url.startsWith(baseUrl)) {
            url = url.substring(baseUrl.length)
          }
          console.log('[CapacitorBridge] Redirecting user to deep link url:', url)
          window.location.href = url
        } else {
          console.log('[CapacitorBridge] No valid redirect URL found in action notification data')
        }
      })

      cleanup = () => {
        window.removeEventListener('themechange', onThemeChange)
        window.removeEventListener('resize', onResizeOrRotate)
        window.removeEventListener('orientationchange', onResizeOrRotate)
        backHandle.remove()
        stateHandle.remove()
        registrationHandle.remove()
        receivedHandle.remove()
        actionHandle.remove()
      }
    })().catch(e => console.warn('CapacitorBridge init failed', e))

    return () => { cleanup?.() }
  }, [router])

  return null
}
