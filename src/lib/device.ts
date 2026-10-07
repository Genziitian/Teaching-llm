/**
 * Single source of truth for "what device is this browser running on".
 *
 * A User-Agent string alone is not reliable (an Android phone in
 * "Desktop site" mode drops the word "Android"; iPadOS pretends to be a Mac),
 * so several independent signals are combined:
 *
 *   1. User-Agent string            – "Android", "Mobile", "iPhone", "iPad"
 *   2. UA Client Hints              – navigator.userAgentData.platform / .mobile
 *   3. navigator.platform           – stays "Linux armv8l / aarch64" on Android
 *                                     even when "Desktop site" is switched on
 *   4. Touch + pointer type         – maxTouchPoints, (pointer: coarse)
 *   5. Physical screen size         – shortest side < 600 CSS px is a phone.
 *                                     This is Android's own phone/tablet
 *                                     boundary (sw600dp).
 */

export type DeviceOS = 'android' | 'ios' | 'other'
export type DeviceFormFactor = 'phone' | 'tablet' | 'desktop'

export interface DeviceSignals {
  userAgent: string
  platform: string
  maxTouchPoints: number
  uaDataPlatform?: string
  uaDataMobile?: boolean
  screenWidth: number
  screenHeight: number
  coarsePointer: boolean
}

export interface DeviceInfo {
  os: DeviceOS
  formFactor: DeviceFormFactor
  isAndroidPhone: boolean
  isAndroidTablet: boolean
  isIPad: boolean
  isIPhone: boolean
  /** Android browser with "Desktop site" switched on (UA hides Android). */
  desktopSiteMode: boolean
  /** Shortest physical screen side in CSS px (0 when unknown). */
  smallestScreenSide: number
  signals: DeviceSignals
}

/** Android's phone/tablet boundary: shortest side of 600dp and up is a tablet. */
export const TABLET_MIN_SHORTEST_SIDE = 600

export function classifyDevice(signals: DeviceSignals): DeviceInfo {
  const ua = signals.userAgent || ''
  const platform = signals.platform || ''
  const touch = signals.maxTouchPoints || 0
  const smallest = Math.min(signals.screenWidth || 0, signals.screenHeight || 0)

  const base = {
    isAndroidPhone: false,
    isAndroidTablet: false,
    isIPad: false,
    isIPhone: false,
    desktopSiteMode: false,
    smallestScreenSide: smallest,
    signals,
  }

  // ── iOS / iPadOS ────────────────────────────────────────────────────────
  if (/iphone|ipod/i.test(ua)) {
    return { ...base, os: 'ios', formFactor: 'phone', isIPhone: true }
  }
  // iPadOS 13+ sends a Mac UA; a "Mac" with a multi-touch screen is an iPad.
  if (/ipad/i.test(ua) || (platform === 'MacIntel' && touch > 1)) {
    return { ...base, os: 'ios', formFactor: 'tablet', isIPad: true }
  }

  // ── Android ─────────────────────────────────────────────────────────────
  const uaSaysAndroid = /android/i.test(ua) || /android/i.test(signals.uaDataPlatform || '')
  // "Desktop site" mode: UA claims desktop Linux, but the hardware platform is
  // still ARM Linux with a touch screen. ChromeOS (CrOS) is excluded.
  const hiddenAndroid =
    !uaSaysAndroid &&
    !/cros/i.test(ua) &&
    /linux\s*(arm|aarch)/i.test(platform) &&
    touch > 0 &&
    signals.coarsePointer

  if (uaSaysAndroid || hiddenAndroid) {
    let isPhone: boolean
    if (smallest > 0) {
      // Screen size is the strongest signal: it cannot be changed by
      // "Desktop site" mode or a spoofed User-Agent.
      isPhone = smallest < TABLET_MIN_SHORTEST_SIDE
    } else if (typeof signals.uaDataMobile === 'boolean') {
      isPhone = signals.uaDataMobile
    } else {
      // Android phones send "Mobile" in the UA, Android tablets do not.
      isPhone = /mobile/i.test(ua)
    }
    return {
      ...base,
      os: 'android',
      formFactor: isPhone ? 'phone' : 'tablet',
      isAndroidPhone: isPhone,
      isAndroidTablet: !isPhone,
      desktopSiteMode: hiddenAndroid,
    }
  }

  // ── Everything else ─────────────────────────────────────────────────────
  if (/webos|blackberry|iemobile|opera mini|windows phone/i.test(ua)) {
    return { ...base, os: 'other', formFactor: 'phone' }
  }
  return { ...base, os: 'other', formFactor: 'desktop' }
}

export function readDeviceSignals(): DeviceSignals {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      userAgent: '', platform: '', maxTouchPoints: 0,
      screenWidth: 0, screenHeight: 0, coarsePointer: false,
    }
  }
  const uaData = (navigator as any).userAgentData as
    | { platform?: string; mobile?: boolean }
    | undefined
  let coarsePointer = false
  try { coarsePointer = window.matchMedia('(pointer: coarse)').matches } catch {}
  return {
    userAgent: navigator.userAgent || navigator.vendor || '',
    platform: navigator.platform || '',
    maxTouchPoints: navigator.maxTouchPoints || 0,
    uaDataPlatform: uaData?.platform,
    uaDataMobile: typeof uaData?.mobile === 'boolean' ? uaData.mobile : undefined,
    screenWidth: window.screen?.width || 0,
    screenHeight: window.screen?.height || 0,
    coarsePointer,
  }
}

/** Classify the current browser. Call on the client only (inside useEffect). */
export function detectDevice(): DeviceInfo {
  return classifyDevice(readDeviceSignals())
}
