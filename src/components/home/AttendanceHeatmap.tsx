'use client'

import { useMemo } from 'react'

/**
 * Attendance heatmap from the dashboard redesign.
 *
 * PLACEHOLDER DATA: the repo has no attendance / streak source yet, so the
 * cells and the four summary numbers below are generated, not real. Replace
 * `buildPlaceholder()` and `PLACEHOLDER_STATS` with a real API (e.g. derived from
 * LectureProgress + live-session joins) before showing this to students.
 */

const WEEKS = 30
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LEVELS = ['var(--gz-line)', 'var(--heat-1, #cdcdc8)', 'var(--heat-2, #9c9c97)', 'var(--heat-3, #5a5a55)', 'var(--gz-ink)']

const PLACEHOLDER_STATS = [
  { label: 'Attendance', value: '85%', unit: 'this term' },
  { label: 'Live sessions', value: '41', unit: 'of 48' },
  { label: 'Current streak', value: '9', unit: 'days' },
  { label: 'Longest streak', value: '23', unit: 'days' },
]

function buildPlaceholder() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - start.getDay() - (WEEKS - 1) * 7)

  const cells: { bg: string; title: string }[] = []
  const months: { label: string; n: number }[] = []
  let lastMonth = -1

  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    if (i % 7 === 0) {
      if (d.getMonth() !== lastMonth) {
        months.push({ label: MON[d.getMonth()], n: 1 })
        lastMonth = d.getMonth()
      } else {
        months[months.length - 1].n++
      }
    }
    if (d > today) {
      cells.push({ bg: 'transparent', title: '' })
      continue
    }
    const v = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1)
    const lvl = d.getDay() === 0 ? (v > 0.8 ? 1 : 0) : v < 0.14 ? 0 : v < 0.4 ? 1 : v < 0.68 ? 2 : v < 0.88 ? 3 : 4
    cells.push({
      bg: LEVELS[lvl],
      title: `${lvl ? lvl + (lvl > 1 ? ' activities' : ' activity') : 'No activity'} on ${d.getDate()} ${MON[d.getMonth()]}`,
    })
  }
  return { cells, months }
}

export default function AttendanceHeatmap() {
  const { cells, months } = useMemo(buildPlaceholder, [])

  return (
    <div className="gz-panel gz-heat" data-placeholder="attendance">
      <div className="gz-heat__main">
        <div className="gz-heat__head">
          <div>
            <span className="gz-heat__title">Attendance</span>
            <span className="gz-heat__sub">Live sessions attended and lectures watched, per day</span>
          </div>
          <div className="gz-heat__legend" aria-hidden="true">
            Less
            {LEVELS.map((l, i) => <span key={i} style={{ background: l }} />)}
            More
          </div>
        </div>
        <div className="gz-heat__scroll">
          <div className="gz-heat__body">
            <div className="gz-heat__days"><span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /></div>
            <div>
              <div className="gz-heat__months">
                {months.map((m, i) => <span key={i} style={{ width: m.n * 16 }}>{m.label}</span>)}
              </div>
              <div className="gz-heat__grid">
                {cells.map((c, i) => <span key={i} title={c.title} style={{ background: c.bg }} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="gz-heat__stats">
        {PLACEHOLDER_STATS.map(s => (
          <div key={s.label}>
            <span>{s.label}</span>
            <b>{s.value}<i>{s.unit}</i></b>
          </div>
        ))}
      </div>
    </div>
  )
}
