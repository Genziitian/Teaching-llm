'use client'

import { useEffect, useState } from 'react'

interface Device {
  deviceId: string
  deviceName: string | null
  platform: string | null
  os: string | null
  appVersion: string | null
  city: string | null
  region: string | null
  country: string | null
  lastLoginAt: string
  logins: number
  isCurrent: boolean
  ip?: string | null
}

const place = (d: Device) => [d.city, d.region && d.region !== d.city ? d.region : null, d.country].filter(Boolean).join(', ')

/** "Where you're logged in" list. Without userId: your own; with userId: that user's (managers, shows IP). */
export default function LoginActivity({ userId }: { userId?: string }) {
  const [devices, setDevices] = useState<Device[] | null>(null)
  useEffect(() => {
    fetch(`/api/user/login-activity${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setDevices(d.devices || []))
      .catch(() => setDevices([]))
  }, [userId])

  if (devices === null) return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading login activity…</div>
  if (devices.length === 0) return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No login activity recorded yet. It appears from the next login.</div>
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {devices.map(d => (
        <li key={d.deviceId} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
          <span aria-hidden style={{ fontSize: 18, lineHeight: '22px' }}>{d.platform === 'android' ? '📱' : '💻'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
              {d.deviceName || 'Unknown device'}
              {d.isCurrent && <span style={{ marginLeft: 8, fontSize: 11, color: '#10b981', fontWeight: 600 }}>This device</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
              {[place(d) || 'Location unknown', d.os, d.appVersion && `app ${d.appVersion}`, d.ip && `IP ${d.ip}`].filter(Boolean).join(' · ')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Last login {new Date(d.lastLoginAt).toLocaleString()} · {d.logins} login{d.logins === 1 ? '' : 's'}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
