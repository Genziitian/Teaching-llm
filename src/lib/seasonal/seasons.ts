/**
 * Seasonal calendar: one place that decides what festive things are live.
 *
 * Everything runs on the visitor's device using their local date, so there is
 * no server work. To change a date, edit the tables below. Nothing else needs
 * to change.
 *
 * Preview any day or banner without waiting for it (handy before a launch):
 *   ?seasonDate=2026-12-25   pretend today is that date (snow amount + banner)
 *   ?festival=diwali         force a banner: quizlab | diwali | chhath | christmas | none
 *   ?snow=1 / ?snow=0        force the snow on or off for this page view
 *   ?decor=diwali&decorLevel=2   force site decorations: diwali | chhath | christmas | none, level 1-4
 */

export type FestivalBanner = 'quizlab' | 'diwali' | 'chhath' | 'christmas' | 'none'

/** Inclusive date ranges, YYYY-MM-DD, in the visitor's local time. First match wins. */
export const BANNER_SCHEDULE: { from: string; to: string; banner: FestivalBanner }[] = [
  { from: '2000-01-01', to: '2026-11-07', banner: 'quizlab' },
  { from: '2026-11-08', to: '2026-11-09', banner: 'diwali' },
  { from: '2026-11-10', to: '2026-11-14', banner: 'quizlab' },
  { from: '2026-11-15', to: '2026-11-15', banner: 'chhath' },
  // 16 Nov – 24 Dec: nothing
  { from: '2026-12-25', to: '2026-12-26', banner: 'christmas' },
]

/**
 * Snow amount over the winter, 0 (none) to 1 (heaviest).
 * Between two points the amount changes smoothly day by day.
 */
export const SNOW_CURVE: { date: string; amount: number }[] = [
  { date: '2026-10-29', amount: 0 },
  { date: '2026-10-30', amount: 0.12 }, // first light flurries
  { date: '2026-11-20', amount: 0.3 },
  { date: '2026-12-10', amount: 0.6 },
  { date: '2026-12-25', amount: 1 }, // Christmas: full snowfall
  { date: '2027-01-01', amount: 1 }, // hold through New Year
  { date: '2027-01-15', amount: 0.45 },
  { date: '2027-01-31', amount: 0.1 }, // last few flakes
  { date: '2027-02-01', amount: 0 },
]

export type DecorTheme = 'diwali' | 'chhath' | 'christmas'

/**
 * Site decorations that build up before a festival, like a home getting ready:
 *   3 days before  level 1  first decorations go up
 *   2 days before  level 2  more pieces added, bulbs hung (not lit yet)
 *   1 day before   level 3  lights switched on
 *   festival day+  level 4  everything, glowing (until `until`)
 */
export const DECOR_SCHEDULE: { theme: DecorTheme; day: string; until: string }[] = [
  { theme: 'diwali', day: '2026-11-08', until: '2026-11-09' },
  { theme: 'christmas', day: '2026-12-25', until: '2027-01-01' },
]
const PREP_DAYS = 3

export function activeDecor(today = seasonalToday()): { theme: DecorTheme; level: 1 | 2 | 3 | 4 } | null {
  const forced = param('decor')
  if (forced === 'none') return null
  if (forced === 'diwali' || forced === 'chhath' || forced === 'christmas') {
    const l = Number(param('decorLevel') || 4)
    return { theme: forced, level: (Math.min(4, Math.max(1, l)) as 1 | 2 | 3 | 4) }
  }
  const prefs = readPrefs()
  if (prefs.off || prefs.decor === false) return null
  const t = keyToTime(today)
  for (const row of DECOR_SCHEDULE) {
    const daysBefore = Math.round((keyToTime(row.day) - t) / 86400000)
    if (t > keyToTime(row.until) || daysBefore > PREP_DAYS) continue
    const level = daysBefore <= 0 ? 4 : ((PREP_DAYS + 1 - daysBefore) as 1 | 2 | 3)
    return { theme: row.theme, level }
  }
  return null
}

/** Pages where nothing festive appears (exams, live classes, video/material viewers, sign-in). */
const BLOCKED_PREFIXES = [
  '/exam-protection',
  '/live/',
  '/material/',
  '/homework/material-viewer',
  '/materials/recordings',
  '/login',
  '/signup',
  '/maintenance',
  '/terminated',
  '/error',
]

export const SNOW_PREF_KEY = 'seasonal-snow-pref' // 'on' | 'off'
export const SNOW_HINT_KEY = 'seasonal-snow-hint-seen'
export const GREETING_SEEN_PREFIX = 'festival-greeting-seen-'

/* ───────────── device preferences (Settings → Festive effects) ─────────────
 * Stored in this browser only. Changing them fires SEASONAL_EVENT so every
 * festive component updates immediately, no reload needed.
 */
export const SEASONAL_EVENT = 'seasonal:change'
const PREFS_KEY = 'seasonal-prefs'

export interface SeasonalPrefs {
  /** master switch: true turns every festive effect off */
  off?: boolean
  decor?: boolean
  greetings?: boolean
  /** preview date YYYY-MM-DD (testing) */
  date?: string
}

export function readPrefs(): SeasonalPrefs {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {} } catch { return {} }
}

export function notifySeasonalChange() {
  try { window.dispatchEvent(new Event(SEASONAL_EVENT)) } catch {}
}

export function writePrefs(patch: Partial<SeasonalPrefs>) {
  const next: Record<string, unknown> = { ...readPrefs(), ...patch }
  Object.keys(next).forEach(k => { if (next[k] === undefined || next[k] === '') delete next[k] })
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch {}
  notifySeasonalChange()
}

export function readSnowPref(): 'on' | 'off' | null {
  try { const v = localStorage.getItem(SNOW_PREF_KEY); return v === 'on' || v === 'off' ? v : null } catch { return null }
}

export function writeSnowPref(on: boolean) {
  try { localStorage.setItem(SNOW_PREF_KEY, on ? 'on' : 'off') } catch {}
  notifySeasonalChange()
}

/** Show the full-screen festival greetings (and the snow hint) again. */
export function resetGreetings() {
  try {
    Object.keys(localStorage).forEach(k => { if (k.startsWith(GREETING_SEEN_PREFIX)) localStorage.removeItem(k) })
    localStorage.removeItem(SNOW_HINT_KEY)
  } catch {}
  notifySeasonalChange()
}

/** Handy dates for the preview picker, built from the schedules above. */
export function previewMarks(): { date: string; label: string; group: string }[] {
  const shift = (key: string, days: number) => toKey(new Date(keyToTime(key) + days * 86400000))
  const names: Record<DecorTheme, string> = { diwali: 'Diwali', chhath: 'Chhath', christmas: 'Christmas' }
  const marks: { date: string; label: string; group: string }[] = [
    { date: SNOW_CURVE[1].date, label: 'Snow starts', group: 'Snow' },
  ]
  DECOR_SCHEDULE.forEach(row => {
    const n = names[row.theme]
    marks.push(
      { date: shift(row.day, -3), label: 'Prep: garland', group: n },
      { date: shift(row.day, -2), label: 'Prep: bulbs hung', group: n },
      { date: shift(row.day, -1), label: 'Prep: lights on', group: n },
      { date: row.day, label: `${n} day`, group: n },
    )
  })
  marks.push(
    { date: FESTIVAL_MAIN_DAY.chhath, label: 'Chhath day', group: 'Chhath' },
    { date: '2026-11-10', label: 'Quiz Lab again', group: 'Banner' },
    { date: '2026-12-10', label: 'Mid December', group: 'Snow' },
    { date: '2027-01-15', label: 'Snow fading', group: 'Snow' },
    { date: '2027-02-01', label: 'All over', group: 'Snow' },
  )
  return marks
}

function param(name: string): string | null {
  try { return new URLSearchParams(window.location.search).get(name) } catch { return null }
}

function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function keyToTime(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12).getTime()
}

/** Today as YYYY-MM-DD, honouring the ?seasonDate= preview override. */
export function seasonalToday(): string {
  const forced = param('seasonDate')
  if (forced && /^\d{4}-\d{2}-\d{2}$/.test(forced)) return forced
  const pref = typeof window !== 'undefined' ? readPrefs().date : undefined
  if (pref && /^\d{4}-\d{2}-\d{2}$/.test(pref)) return pref
  return realToday()
}

export function realToday(): string {
  return toKey(new Date())
}

/** The one day each festival screen opens by itself (other festival days show only the corner badge). */
export const FESTIVAL_MAIN_DAY: Record<'diwali' | 'chhath' | 'christmas', string> = {
  diwali: '2026-11-08',
  chhath: '2026-11-15',
  christmas: '2026-12-25',
}

export function isFestivalMainDay(festival: 'diwali' | 'chhath' | 'christmas', today = seasonalToday()): boolean {
  return FESTIVAL_MAIN_DAY[festival] === today
}

export function activeBanner(today = seasonalToday()): FestivalBanner {
  const forced = param('festival') as FestivalBanner | null
  if (forced && ['quizlab', 'diwali', 'chhath', 'christmas', 'none'].includes(forced)) return forced
  let banner: FestivalBanner = 'none'
  for (const row of BANNER_SCHEDULE) {
    if (today >= row.from && today <= row.to) { banner = row.banner; break }
  }
  if (banner !== 'quizlab' && banner !== 'none') {
    const p = readPrefs()
    if (p.off || p.greetings === false) return 'none'
  }
  return banner
}

/** 0..1 snow amount for today (0 = no snow season). */
export function snowAmount(today = seasonalToday()): number {
  if (process.env.NEXT_PUBLIC_SEASONAL_EFFECTS === 'off') return 0
  const forced = param('snow')
  if (forced === '0') return 0
  if (forced !== '1' && readPrefs().off) return 0
  const t = keyToTime(today)
  const pts = SNOW_CURVE
  let amount = 0
  if (t >= keyToTime(pts[0].date) && t <= keyToTime(pts[pts.length - 1].date)) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = keyToTime(pts[i].date)
      const b = keyToTime(pts[i + 1].date)
      if (t >= a && t <= b) {
        const k = b === a ? 1 : (t - a) / (b - a)
        const e = k * k * (3 - 2 * k) // smooth step between points
        amount = pts[i].amount + (pts[i + 1].amount - pts[i].amount) * e
        break
      }
    }
  }
  if (forced === '1' && amount <= 0) amount = 0.6
  return Math.max(0, Math.min(1, amount))
}

/**
 * An entry ending in "/" blocks only the pages under it ("/live/" = a live class,
 * not the Live Sessions list). Other entries block the page itself and everything under it.
 */
export function isSeasonalRouteBlocked(pathname: string): boolean {
  return BLOCKED_PREFIXES.some(p => (p.endsWith('/') ? pathname.startsWith(p) : pathname === p || pathname.startsWith(p + '/')))
}
