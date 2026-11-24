import { randomUUID } from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sseEmitter } from '@/lib/sse'
import { sendPushToUsers } from '@/lib/push'
import { sendFcmToUsers } from '@/lib/fcm'

const DEVICE_COOKIE = 'gz_did'
const clip = (v: string | null | undefined, n = 120) => (v ? v.trim().slice(0, n) || null : null)

/** "Chrome on Windows", "Safari on iPhone", ... from a browser User-Agent (enough for a login list, not analytics). */
export function describeUserAgent(ua: string): { name: string; os: string | null } {
  const os =
    /Android ([\d.]+)/.exec(ua)?.[0] ??
    (/iPhone|iPad/.test(ua) ? `iOS ${(/OS (\d+[_\d]*)/.exec(ua)?.[1] ?? '').replace(/_/g, '.')}`.trim() : null) ??
    (/Windows/.test(ua) ? 'Windows' : null) ??
    (/Mac OS X/.test(ua) ? 'macOS' : null) ??
    (/CrOS/.test(ua) ? 'ChromeOS' : null) ??
    (/Linux/.test(ua) ? 'Linux' : null)
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser'
  const where = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : os?.split(' ')[0] ?? 'unknown device'
  return { name: `${browser} on ${where}`, os }
}

/**
 * Logs a login with device + coarse location and alerts the user when it's a device we haven't
 * seen for them before. App sends X-Device-Id / X-Device-Name / X-Device-OS / X-App-Version;
 * browsers get a long-lived gz_did cookie. Location comes from Cloudflare's visitor-location
 * headers (cf-ipcity / cf-region need Cloudflare "Add visitor location headers" turned on;
 * cf-ipcountry is always there). Never throws: a logging failure must not block the login.
 */
export async function recordLogin(request: NextRequest, response: NextResponse, userId: string) {
  try {
    const h = request.headers
    const appDeviceId = clip(h.get('x-device-id'), 64)
    let deviceId = appDeviceId ?? clip(request.cookies.get(DEVICE_COOKIE)?.value, 64)
    if (!deviceId) {
      deviceId = randomUUID()
      response.cookies.set(DEVICE_COOKIE, deviceId, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 730 })
    }
    const ua = describeUserAgent(h.get('user-agent') || '')
    const log = {
      userId,
      deviceId,
      platform: appDeviceId ? 'android' : 'web',
      deviceName: appDeviceId ? clip(h.get('x-device-name')) ?? 'Android phone' : ua.name,
      os: appDeviceId ? clip(h.get('x-device-os'), 40) : ua.os,
      appVersion: clip(h.get('x-app-version'), 40),
      ip: clip(h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0] ?? request.ip, 64),
      city: clip(h.get('cf-ipcity'), 80),
      region: clip(h.get('cf-region'), 80),
      country: clip(h.get('cf-ipcountry'), 8)?.replace(/^(XX|T1)$/, '') || null, // XX = unknown, T1 = Tor
    }

    // Only users with tracked history get alerts, so the first login after this ships doesn't alert everyone.
    const [tracked, seen] = await Promise.all([
      prisma.loginLog.count({ where: { userId, deviceId: { not: null } } }),
      prisma.loginLog.count({ where: { userId, deviceId } }),
    ])
    await prisma.loginLog.create({ data: log })
    if (tracked > 0 && seen === 0) alertNewDevice(userId, log).catch(console.error)
  } catch (err) {
    console.error('[login-device] could not record login:', err)
  }
}

export function formatPlace(l: { city?: string | null; region?: string | null; country?: string | null }) {
  return [l.city, l.region && l.region !== l.city ? l.region : null, l.country].filter(Boolean).join(', ')
}

async function alertNewDevice(userId: string, l: { deviceName: string | null; city: string | null; region: string | null; country: string | null }) {
  const place = formatPlace(l)
  const title = 'New login to your account 🔐'
  const body = `${l.deviceName || 'A new device'}${place ? ` near ${place}` : ''}. If this wasn't you, contact support right away.`
  await prisma.notification.create({ data: { userId, title, content: body, type: 'INFO' } })
  sseEmitter.emit(`user:${userId}:notify`)
  const payload = { title, body, url: '/settings', tag: 'new_device_login', importance: 'high' as const, sound: 'default' as const }
  await Promise.allSettled([sendPushToUsers([userId], payload), sendFcmToUsers([userId], payload)])
}
