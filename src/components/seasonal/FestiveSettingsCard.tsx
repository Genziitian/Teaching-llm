'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import {
  activeBanner,
  activeDecor,
  previewMarks,
  readPrefs,
  readSnowPref,
  realToday,
  resetGreetings,
  seasonalToday,
  snowAmount,
  writePrefs,
  writeSnowPref,
  type SeasonalPrefs,
} from '@/lib/seasonal/seasons'
import { useSeasonalTick } from './useSeasonalTick'

/**
 * Settings → Festive effects.
 * Everyone: switch snow / decorations / greetings on or off on this device.
 * Managers: also a preview date (time travel) and tools to test the festival days.
 * Nothing here is saved on the server; it only changes this browser.
 */

const BANNER_NAMES: Record<string, string> = {
  quizlab: 'Quiz Lab',
  diwali: 'Diwali greeting',
  chhath: 'Chhath Puja + exam wishes',
  christmas: 'Christmas greeting',
  none: 'Nothing',
}
const DECOR_NAMES = { diwali: 'Diwali', chhath: 'Chhath', christmas: 'Christmas' }
const LEVEL_NAMES = ['', 'garland going up', 'bulbs hung (off)', 'lights on', 'full festival']

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 46, height: 26, borderRadius: 13, flexShrink: 0, border: 'none', padding: 0,
        background: checked ? 'var(--primary)' : '#4b5563',
        boxShadow: checked ? 'inset 2px 2px 5px rgba(0,0,0,0.2)' : 'inset 2px 2px 4px rgba(0,0,0,0.3), inset -2px -2px 4px rgba(255,255,255,0.05)',
        position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        transition: 'background 0.25s ease, opacity 0.2s ease',
      }}
    >
      <span style={{
        position: 'absolute', top: 4, left: checked ? 24 : 4, width: 18, height: 18, borderRadius: '50%',
        background: 'var(--surface)', boxShadow: '1px 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.25s ease',
      }} />
    </button>
  )
}

function fmt(key: string) {
  return new Date(key + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function FestiveSettingsCard({ isManager, isMobile }: { isManager: boolean; isMobile: boolean }) {
  const tick = useSeasonalTick()
  const [prefs, setPrefs] = useState<SeasonalPrefs>({})
  const [snowPref, setSnowPref] = useState<'on' | 'off' | null>(null)
  const [today, setToday] = useState('')
  const [status, setStatus] = useState<{ banner: string; decor: string; snow: number } | null>(null)
  const [replayed, setReplayed] = useState(false)

  useEffect(() => {
    setPrefs(readPrefs())
    setSnowPref(readSnowPref())
    const d = seasonalToday()
    setToday(d)
    const dec = activeDecor(d)
    setStatus({
      banner: BANNER_NAMES[activeBanner(d)] ?? 'Nothing',
      decor: dec ? `${DECOR_NAMES[dec.theme]}, level ${dec.level} (${LEVEL_NAMES[dec.level]})` : 'None',
      snow: Math.round(snowAmount(d) * 100),
    })
  }, [tick])

  const marks = useMemo(() => previewMarks(), [])
  const groups = useMemo(() => Array.from(new Set(marks.map(m => m.group))), [marks])

  const allOff = !!prefs.off
  const snowOn = snowPref !== 'off'
  const previewing = !!prefs.date && prefs.date !== realToday()

  const shiftDay = (days: number) => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() + days)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    writePrefs({ date: key === realToday() ? undefined : key })
  }

  const row: CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: isMobile ? '12px 14px' : '14px 18px', borderRadius: 14, background: 'var(--surface-2)',
    boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)', gap: 12,
  }
  const title: CSSProperties = { fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }
  const sub: CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }
  const chip = (active: boolean): CSSProperties => ({
    padding: '7px 11px', borderRadius: 999, border: active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
    background: active ? 'var(--primary-light)' : 'var(--surface)', color: active ? 'var(--primary)' : 'var(--text-secondary)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  })
  const btn: CSSProperties = {
    padding: '9px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text-primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
  }

  return (
    <div className="card" data-no-snow style={{ padding: isMobile ? 16 : 28 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3636e8" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 2v20M4.2 6.5l15.6 11M4.2 17.5l15.6-11" />
          <path d="M9.5 3.8 12 6l2.5-2.2M9.5 20.2 12 18l2.5 2.2" />
        </svg>
        Festive effects
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
        Snow, festival decorations and festival greetings. These switches only change this device.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={row}>
          <div style={{ flex: 1 }}>
            <div style={title}>Festive design</div>
            <div style={sub}>Turn everything below on or off at once</div>
          </div>
          <Toggle checked={!allOff} onChange={v => writePrefs({ off: v ? undefined : true })} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10, opacity: allOff ? 0.5 : 1, transition: 'opacity .2s' }}>
          <div style={row}>
            <div style={{ flex: 1 }}><div style={title}>Snow</div><div style={sub}>Falling and settling snow</div></div>
            <Toggle checked={snowOn} disabled={allOff} onChange={v => writeSnowPref(v)} />
          </div>
          <div style={row}>
            <div style={{ flex: 1 }}><div style={title}>Decorations</div><div style={sub}>Garlands and lights on top</div></div>
            <Toggle checked={prefs.decor !== false} disabled={allOff} onChange={v => writePrefs({ decor: v ? undefined : false })} />
          </div>
          <div style={row}>
            <div style={{ flex: 1 }}><div style={title}>Greetings</div><div style={sub}>Festival screens on the dashboard</div></div>
            <Toggle checked={prefs.greetings !== false} disabled={allOff} onChange={v => writePrefs({ greetings: v ? undefined : false })} />
          </div>
        </div>

        {isManager && (
          <div style={{ marginTop: 10, padding: isMobile ? 14 : 18, borderRadius: 16, border: `1.5px dashed ${previewing ? '#f59e0b' : 'var(--border)'}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Preview &amp; testing <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>(managers)</span></div>
                <div style={sub}>Pretend it&apos;s another day to see what students will see. Only affects your browser.</div>
              </div>
              {previewing && (
                <button type="button" style={{ ...btn, background: '#111827', color: '#fff', border: 'none' }} onClick={() => writePrefs({ date: undefined })}>
                  Back to today
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={btn} onClick={() => shiftDay(-1)} aria-label="Previous day">‹ Day</button>
              <input
                type="date"
                className="form-input"
                value={today}
                onChange={e => writePrefs({ date: e.target.value && e.target.value !== realToday() ? e.target.value : undefined })}
                style={{ width: 'auto', minWidth: 170, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'none', fontWeight: 700 }}
              />
              <button type="button" style={btn} onClick={() => shiftDay(1)} aria-label="Next day">Day ›</button>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: previewing ? '#d97706' : 'var(--text-muted)' }}>
                {today ? (previewing ? `Previewing ${fmt(today)}` : `Today, ${fmt(today)}`) : ''}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groups.map(gr => (
                <div key={gr} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? 2 : 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', width: 70, flexShrink: 0 }}>{gr}</span>
                  {marks.filter(m => m.group === gr).map(m => (
                    <button key={m.date + m.label} type="button" style={chip(today === m.date)} onClick={() => writePrefs({ date: m.date === realToday() ? undefined : m.date })} title={fmt(m.date)}>
                      {m.label} · {new Date(m.date + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {status && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { k: 'Dashboard banner', v: status.banner },
                  { k: 'Decorations', v: status.decor },
                  { k: 'Snow amount', v: status.snow ? `${status.snow}%` : 'No snow' },
                ].map(s => (
                  <div key={s.k} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--surface-2)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s.k}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{s.v}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={btn} onClick={() => { resetGreetings(); setReplayed(true); window.setTimeout(() => setReplayed(false), 2500) }}>
                {replayed ? 'Greetings reset' : 'Replay festival greeting'}
              </button>
              <Link href="/dashboard" style={{ ...btn, textDecoration: 'none', background: 'var(--primary)', color: '#fff', border: 'none' }}>
                Open dashboard to see it
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
