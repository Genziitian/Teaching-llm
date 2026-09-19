'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import useSWR from 'swr'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type RangeKey = 'today' | 'yesterday' | '7d' | '30d' | '3m'

const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '3m': 'Last 3 Months',
}

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f97316', '#ef4444', '#84cc16']

export default function AnalyticsDashboard() {
  const [range, setRange] = useState<RangeKey>('7d')
  const [countdown, setCountdown] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<string>('all')
  const [selectedTerm, setSelectedTerm] = useState<string>('all')

  const { data, isLoading, mutate } = useSWR(
    `/api/analytics/summary?range=${range}&courseId=${selectedCourse}`,
    fetcher,
    { refreshInterval: 0 }
  )

  const { data: feedbackStats } = useSWR('/api/analytics/feedback', fetcher)
  const { data: coursesList } = useSWR('/api/courses', fetcher)

  // ─── Timer Logic ───────────────────────────────────────────────────
  const isUpdatingRef = useRef(false)

  const computeCountdown = useCallback(() => {
    if (!data?.timer?.lastUpdatedAt) return 'No data yet'
    const last = new Date(data.timer.lastUpdatedAt).getTime()
    const intervalMs = (data.timer.cronIntervalHours || 24) * 60 * 60 * 1000
    const nextUpdate = last + intervalMs
    const diff = nextUpdate - Date.now()

    if (diff <= 0) {
      if (!isUpdatingRef.current) {
        mutate()
      }
      return 'Updating...'
    }

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }, [data, mutate])

  useEffect(() => {
    const timer = setInterval(() => setCountdown(computeCountdown()), 1000)
    setCountdown(computeCountdown())
    return () => clearInterval(timer)
  }, [computeCountdown])

  // ─── Auto-Trigger Compute if Stale ─────────────────────────────────
  useEffect(() => {
    if (countdown === 'Updating...' && !isUpdatingRef.current) {
      isUpdatingRef.current = true
      fetch('/api/analytics/compute', { method: 'POST' })
        .then(() => mutate())
        .finally(() => {
          // Re-enable trigger after 30s just in case
          setTimeout(() => { isUpdatingRef.current = false }, 30000)
        })
    }
  }, [countdown, mutate])

  // ─── Shared Styles ─────────────────────────────────────────────────
  const neuCard: React.CSSProperties = {
    borderRadius: '20px',
    background: 'var(--surface-2)',
    boxShadow: '6px 6px 14px var(--neu-dark), -6px -6px 14px var(--neu-light)',
    padding: '24px',
  }

  const kpiAccentBar = (color: string): React.CSSProperties => ({
    position: 'absolute' as const,
    top: 0, left: 0, width: '4px', height: '100%',
    background: color, borderRadius: '20px 0 0 20px',
  })

  // ─── Loading / Error ──────────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#9999b0' }}>
        <div className="spinner" style={{ width: 32, height: 32, border: '3px solid #e0e3ea', borderTopColor: '#6366f1', borderRadius: '50%', margin: '0 auto 16px' }} />
        <div style={{ fontSize: '15px', fontWeight: 700 }}>Loading Analytics...</div>
        <div style={{ marginTop: '8px', fontSize: '13px' }}>Fetching precomputed data</div>
      </div>
    )
  }

  if (data?.error) {
    return (
      <div style={{ ...neuCard, textAlign: 'center', padding: '60px', color: '#ef4444' }}>
        <div style={{ fontSize: '16px', fontWeight: 700 }}>Error loading analytics</div>
        <div style={{ marginTop: '8px', fontSize: '13px', color: '#9999b0' }}>{data.error}</div>
      </div>
    )
  }

  const safeCoursesList = Array.isArray(coursesList) ? coursesList : []
  const disabledCourseIds = new Set(
    safeCoursesList
      .filter((c: any) => c.isDisabled || (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()))
      .map((c: any) => c.id)
  )
  const disabledCourseNames = new Set(
    safeCoursesList
      .filter((c: any) => c.isDisabled || (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()))
      .map((c: any) => (c.name || c.title || '').trim().toLowerCase())
  )

  const activeCourses = safeCoursesList.filter((c: any) => !disabledCourseIds.has(c.id))

  const summary = data?.summary || {}
  const dailyTrend = data?.dailyTrend || []
  const hourlyActivity = data?.hourlyActivity || {}
  const rawTopCourses = data?.topCourses || []
  const rawCourseDistribution = data?.courseDistribution || []
  const rawCourseGrowth = data?.courseGrowth || []
  const demographics = data?.demographics || null

  const topCourses = rawTopCourses.filter((c: any) =>
    !disabledCourseIds.has(c.id || c.courseId) && !disabledCourseNames.has((c.name || c.courseName || '').trim().toLowerCase())
  )
  const courseDistribution = rawCourseDistribution.filter((c: any) =>
    !disabledCourseIds.has(c.id || c.courseId) && !disabledCourseNames.has((c.name || c.courseName || '').trim().toLowerCase())
  )
  const courseGrowth = rawCourseGrowth.filter((cg: any) =>
    !disabledCourseIds.has(cg.courseId) && !disabledCourseNames.has((cg.courseName || '').trim().toLowerCase())
  )

  const genderData = demographics ? Object.entries(demographics.gender || {}).map(([k, v]) => ({ name: k, value: v as number })).filter(d => d.value > 0) : []
  const ageData = demographics ? Object.entries(demographics.age || {}).map(([k, v]) => ({ name: k, value: v as number })).filter(d => d.value > 0) : []
  const stateData = demographics ? Object.entries(demographics.state || {}).map(([k, v]) => ({ name: k, value: v as number })).filter(d => d.name !== 'Unknown' && d.value > 0).sort((a, b) => b.value - a.value) : []
  const totalStudents = genderData.reduce((acc, d) => acc + d.value, 0) || 1
  const totalStateStudents = stateData.reduce((acc, d) => acc + d.value, 0) || 1
  const totalAgeStudents = ageData.reduce((acc, d) => acc + d.value, 0) || 1

  // IITM Academic Data
  const joinYearData = demographics && demographics.iitmJoinYear ? Object.entries(demographics.iitmJoinYear).map(([k, v]) => ({ name: k, value: v as number })).filter(d => d.value > 0).sort((a, b) => a.name.localeCompare(b.name)) : []
  const joinMonthData = demographics && demographics.iitmJoinMonth ? Object.entries(demographics.iitmJoinMonth).map(([k, v]) => ({ name: k, value: v as number })).filter(d => d.value > 0) : []
  const levelData = demographics && demographics.iitmLevel ? Object.entries(demographics.iitmLevel).map(([k, v]) => ({ name: k, value: v as number })).filter(d => d.value > 0) : []
  const userTypeData = demographics && demographics.iitmUserType ? Object.entries(demographics.iitmUserType).map(([k, v]) => ({ name: k, value: v as number })).filter(d => d.value > 0) : []

  const YEAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899']
  const MONTH_COLORS = ['#f59e0b', '#10b981', '#8b5cf6']

  const GENDER_CONFIG: Record<string, { color: string; icon: string }> = {
    MALE:        { color: '#3b82f6', icon: '♂' },
    FEMALE:      { color: '#ec4899', icon: '♀' },
    OTHER:       { color: '#a855f7', icon: '⚧' },
    UNSPECIFIED: { color: '#9999b0', icon: '?' },
  }
  const AGE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#9999b0']

  // Format daily trend for recharts
  const trendData = dailyTrend.map((d: any) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    Enrollments: d.enrollments,
    'New Users': d.newUsers,
    'Active Users': d.activeUsers,
  }))

  // Format hourly data for recharts
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    Activity: (hourlyActivity && typeof hourlyActivity === 'object' ? (hourlyActivity[String(h)] as number) : 0) || 0,
  }))

  // Pie data
  const totalPieEnrollments = courseDistribution.reduce((acc: number, c: any) => acc + c.count, 0) || 1
  const pieData = courseDistribution.slice(0, 8).map((c: any, i: number) => ({
    name: c.name.length > 20 ? c.name.substring(0, 18) + '…' : c.name,
    value: c.count,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }))
  // Add "Others" if more than 8 courses
  if (courseDistribution.length > 8) {
    const othersCount = courseDistribution.slice(8).reduce((acc: number, c: any) => acc + c.count, 0)
    pieData.push({ name: 'Others', value: othersCount, fill: '#94a3b8' })
  }

  // Custom tooltip style
  const tooltipStyle = {
    backgroundColor: '#1e1e3a',
    border: 'none',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '12px',
    color: '#fff',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ─── Timer + Filter Bar ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map(key => (
              <button
                key={key}
                onClick={() => setRange(key)}
                style={{
                  padding: '8px 18px', borderRadius: '50px', border: 'none',
                  background: range === key ? '#3636e8' : 'var(--surface-2)',
                  color: range === key ? '#fff' : 'var(--text-secondary)',
                  boxShadow: range === key
                    ? '0 4px 12px rgba(54,54,232,0.3)'
                    : '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
                  fontWeight: 700, fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {RANGE_LABELS[key]}
              </button>
            ))}
          </div>

          <select
            id="course-select"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            style={{
              padding: '8px 18px',
              borderRadius: '50px',
              border: 'none',
              background: 'var(--surface-2)',
              color: 'var(--text-secondary)',
              boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s',
            }}
          >
            <option value="all">All Courses</option>
            {activeCourses.map((course: any) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 20px', borderRadius: '50px', background: 'var(--surface-2)',
          boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#6366f1', fontVariantNumeric: 'tabular-nums' }}>
            Next update in {countdown}
          </span>
        </div>
      </div>

      {/* ─── KPI Cards ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
        {[
          { label: 'Total Students', value: summary.totalUsers, color: '#3636e8' },
          { label: 'New Users', value: summary.newUsers, color: '#10b981' },
          { label: 'Returning Users', value: summary.returningUsers, color: '#6366f1' },
          { label: 'Active Users', value: summary.activeUsers, color: '#f59e0b' },
        ].map((kpi, i) => (
          <div key={i} style={{ ...neuCard, position: 'relative', overflow: 'hidden' }}>
            <div style={kpiAccentBar(kpi.color)} />
            <div style={{ paddingLeft: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#9999b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
                {typeof kpi.value === 'number' ? (
                  Number.isInteger(kpi.value) ? kpi.value.toLocaleString() : kpi.value.toFixed(2)
                ) : '—'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Enrollment Trend (Area Chart) ──────────────────────────── */}
      <div style={neuCard}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '20px', color: 'var(--text-primary)' }}>
          Enrollment Trend ({RANGE_LABELS[range]})
        </h3>
        {trendData.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9999b0', fontSize: '13px' }}>
            No data available for this range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradEnrollments" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#dddfe6" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9999b0' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9999b0' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
              <Area type="monotone" dataKey="Enrollments" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#gradEnrollments)" />
              <Area type="monotone" dataKey="Active Users" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#gradActive)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── Top Courses & Course Distribution ──────────────────────── */}
      {selectedCourse === 'all' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

          {/* Top 7 Courses (Bar Chart) */}
          <div style={neuCard}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '20px', color: 'var(--text-primary)' }}>
              🏆 Top Courses
            </h3>
            {topCourses.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9999b0', fontSize: '13px' }}>No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={topCourses.map((c: any) => ({
                    name: c.name.length > 15 ? c.name.substring(0, 13) + '…' : c.name,
                    Students: c.count,
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#dddfe6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9999b0' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: '#9999b0', fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="Students" radius={[0, 6, 6, 0]} barSize={20}>
                    {topCourses.map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Course Distribution (Pie Chart) */}
          <div style={neuCard}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '20px', color: 'var(--text-primary)' }}>
              🍩 Course Distribution
            </h3>
            {pieData.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9999b0', fontSize: '13px' }}>No data</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <ResponsiveContainer width="50%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                  {courseDistribution.map((c: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                      <span style={{
                        width: '10px', height: '10px', borderRadius: '3px', flexShrink: 0,
                        background: PIE_COLORS[i % PIE_COLORS.length],
                      }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {c.name}
                      </span>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{c.count}</span>
                      <span style={{ color: '#9999b0', fontSize: '11px' }}>
                        ({((c.count / totalPieEnrollments) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}



      {/* ─── Audience Demographics ─────────────────────────────────── */}
      <div>
        {/* Section heading */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Audience Demographics</h2>
            <p style={{ fontSize: '12px', color: '#9999b0', marginTop: '4px', fontWeight: 600 }}>Based on profile data from all active students</p>
          </div>
          {!demographics && (
            <span style={{
              fontSize: '11px', padding: '6px 14px', borderRadius: '50px', fontWeight: 700,
              background: '#fef3c7', color: '#d97706'
            }}>⚠ Run analytics compute to populate</span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: '24px' }}>

          {/* ── Gender Card ── */}
          <div style={neuCard}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '20px', color: 'var(--text-primary)' }}>Gender Split</h3>
            {!demographics || genderData.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9999b0', fontSize: '13px' }}>No data yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'] as const).map(key => {
                  const entry = genderData.find(g => g.name === key)
                  const count = entry?.value ?? 0
                  const pct = Math.round((count / totalStudents) * 100)
                  const cfg = GENDER_CONFIG[key]
                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{key.charAt(0) + key.slice(1).toLowerCase()}</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: cfg.color }}>{count} <span style={{ fontSize: '11px', color: '#9999b0', fontWeight: 600 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: '8px', borderRadius: '4px', background: '#e0e3ea', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Age Card ── */}
          <div style={neuCard}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '20px', color: 'var(--text-primary)' }}>Age Brackets</h3>
            {!demographics || ageData.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9999b0', fontSize: '13px' }}>No data yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {ageData.map((a, i) => {
                  const pct = Math.round((a.value / totalAgeStudents) * 100)
                  return (
                    <div key={a.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{a.name}</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: AGE_COLORS[i % AGE_COLORS.length] }}>{a.value} <span style={{ fontSize: '11px', color: '#9999b0', fontWeight: 600 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: '8px', borderRadius: '4px', background: '#e0e3ea', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: AGE_COLORS[i % AGE_COLORS.length], borderRadius: '4px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── State Distribution Card ── */}
          <div style={{ ...neuCard, maxHeight: '380px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)', flexShrink: 0 }}>State Distribution</h3>
            {!demographics || stateData.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9999b0', fontSize: '13px' }}>No location data yet</div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                {stateData.map((s, i) => {
                  const pct = Math.round((s.value / totalStateStudents) * 100)
                  const barColor = PIE_COLORS[i % PIE_COLORS.length]
                  return (
                    <div key={s.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: barColor, flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</span>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>{s.value} <span style={{ color: '#9999b0', fontWeight: 600 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: '#e0e3ea', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ─── IITM BS Degree Academic Distributions ─────────────────── */}
      <div style={{ marginTop: '32px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>IITM BS Academic Analysis</h2>
            <p style={{ fontSize: '12px', color: '#9999b0', marginTop: '4px', fontWeight: 600 }}>Cohort year, term, levels and category distributions</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          
          {/* Cohort Year & Term Card */}
          <div style={neuCard}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>Admission Cohorts</h3>
            {joinYearData.length === 0 && joinMonthData.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#9999b0', fontSize: '13px' }}>No cohort data available</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Year Bar Chart */}
                <div style={{ height: '150px', width: '100%' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Join Year Distribution</span>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={joinYearData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                      <XAxis dataKey="name" stroke="#9999b0" fontSize={11} tickLine={false} />
                      <YAxis stroke="#9999b0" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                      <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                        {joinYearData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={YEAR_COLORS[index % YEAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Term Pie Chart */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '100px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '12px' }}>
                  <div style={{ height: '100%', width: '50%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={joinMonthData}
                          cx="50%"
                          cy="50%"
                          innerRadius={25}
                          outerRadius={38}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {joinMonthData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={MONTH_COLORS[index % MONTH_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {joinMonthData.map((m, i) => {
                      const total = joinMonthData.reduce((acc, curr) => acc + curr.value, 0) || 1
                      const pct = Math.round((m.value / total) * 100)
                      return (
                        <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: MONTH_COLORS[i % MONTH_COLORS.length] }} />
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{m.value} ({pct}%)</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Current Level Card */}
          <div style={neuCard}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>Program Levels</h3>
            {levelData.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#9999b0', fontSize: '13px' }}>No program level data available</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 'calc(100% - 36px)' }}>
                <div style={{ height: '160px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={levelData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {levelData.map((entry, index) => {
                          const levelColorMap: Record<string, string> = {
                            Qualifier: '#6366f1',
                            Foundation: '#3b82f6',
                            Diploma: '#8b5cf6',
                            Degree: '#ec4899',
                          }
                          const fillColor = levelColorMap[entry.name] || PIE_COLORS[index % PIE_COLORS.length]
                          return <Cell key={`cell-${index}`} fill={fillColor} />
                        })}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '12px' }}>
                  {levelData.map((lvl, i) => {
                    const total = levelData.reduce((acc, curr) => acc + curr.value, 0) || 1
                    const pct = Math.round((lvl.value / total) * 100)
                    const levelColorMap: Record<string, string> = {
                      Qualifier: '#6366f1',
                      Foundation: '#3b82f6',
                      Diploma: '#8b5cf6',
                      Degree: '#ec4899',
                    }
                    const badgeColor = levelColorMap[lvl.name] || PIE_COLORS[i % PIE_COLORS.length]
                    return (
                      <div key={lvl.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: badgeColor, flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '11px', whiteSpace: 'nowrap' }}>{lvl.name}</span>
                          <span style={{ color: '#9999b0', fontSize: '9px' }}>{lvl.value} ({pct}%)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Student Category Card */}
          <div style={neuCard}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>Student Categories</h3>
            {userTypeData.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#9999b0', fontSize: '13px' }}>No student category data available</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 'calc(100% - 36px)' }}>
                <div style={{ height: '160px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={userTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={20}
                        outerRadius={55}
                        dataKey="value"
                      >
                        {userTypeData.map((entry, index) => {
                          const typeColorMap: Record<string, string> = {
                            STANDALONE: '#10b981',
                            'DUAL DEGREE': '#06b6d4',
                            'WORKING PROFESSIONAL': '#f59e0b',
                          }
                          const fillColor = typeColorMap[entry.name] || PIE_COLORS[index % PIE_COLORS.length]
                          return <Cell key={`cell-${index}`} fill={fillColor} />
                        })}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '12px' }}>
                  {userTypeData.map((t, i) => {
                    const total = userTypeData.reduce((acc, curr) => acc + curr.value, 0) || 1
                    const pct = Math.round((t.value / total) * 100)
                    const typeColorMap: Record<string, string> = {
                      STANDALONE: '#10b981',
                      'DUAL DEGREE': '#06b6d4',
                      'WORKING PROFESSIONAL': '#f59e0b',
                    }
                    const badgeColor = typeColorMap[t.name] || PIE_COLORS[i % PIE_COLORS.length]
                    return (
                      <div key={t.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: badgeColor, flexShrink: 0 }} />
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{t.name.toLowerCase()}</span>
                        </div>
                        <span style={{ color: '#9999b0', fontWeight: 600, fontSize: '10px' }}>{t.value} ({pct}%)</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ─── Batch Distribution (Live vs Recorded) ──────────────────── */}
      {data?.batchStats && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📹 Batch Distribution (Live vs Recorded)</span>
              </h2>
              <p style={{ fontSize: '12px', color: '#9999b0', marginTop: '4px', fontWeight: 600 }}>
                Breakdown of students enrolled in Live vs Recorded batches across all active courses
              </p>
            </div>
          </div>

          <div style={neuCard}>
            {(() => {
              const bStats = data.batchStats
              const totalEnrolled = bStats.totalEnrolledStudents || 1
              const totalBase = selectedCourse === 'all' ? (bStats.totalStudents || totalEnrolled) : totalEnrolled
              const livePct = Math.round((bStats.liveStudents / totalBase) * 100)
              const recPct = Math.round((bStats.recordedStudents / totalBase) * 100)
              const bothPct = Math.round((bStats.bothStudents / totalBase) * 100)
              const notEnrolledPct = Math.round((bStats.notEnrolledStudents / totalBase) * 100)

              return (
                <div>
                  {/* Metric Cards Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                    {/* Live Batch Card */}
                    <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#10b981' }} />
                      <div style={{ paddingLeft: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#9999b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Batch Students</span>
                          <span style={{ fontSize: '18px' }}>🔴</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
                          {bStats.liveStudents.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
                          {livePct}% of {selectedCourse === 'all' ? 'total' : 'enrolled'} students 
                          {selectedCourse === 'all' && <span style={{ color: '#9999b0', fontWeight: 600 }}> ({bStats.liveOnlyStudents} Live Only)</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#9999b0', marginTop: '6px' }}>
                          {bStats.totalLiveEnrollments.toLocaleString()} total live course enrollments
                        </div>
                      </div>
                    </div>

                    {/* Recorded Batch Card */}
                    <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#f59e0b' }} />
                      <div style={{ paddingLeft: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#9999b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recorded Batch Students</span>
                          <span style={{ fontSize: '18px' }}>📼</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
                          {bStats.recordedStudents.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>
                          {recPct}% of {selectedCourse === 'all' ? 'total' : 'enrolled'} students 
                          {selectedCourse === 'all' && <span style={{ color: '#9999b0', fontWeight: 600 }}> ({bStats.recordedOnlyStudents} Recorded Only)</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#9999b0', marginTop: '6px' }}>
                          {bStats.totalRecordedEnrollments.toLocaleString()} total recorded course enrollments
                        </div>
                      </div>
                    </div>

                    {/* Both (Dual Access) Card */}
                    {selectedCourse === 'all' && (
                      <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#8b5cf6' }} />
                        <div style={{ paddingLeft: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#9999b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Both (Live + Recorded)</span>
                            <span style={{ fontSize: '18px' }}>⚡</span>
                          </div>
                          <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
                            {bStats.bothStudents.toLocaleString()}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#8b5cf6', marginTop: '4px' }}>
                            {bothPct}% hybrid enrolled
                          </div>
                          <div style={{ fontSize: '11px', color: '#9999b0', marginTop: '6px' }}>
                            Students enrolled in both live & recorded courses
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Not Enrolled Card */}
                    {selectedCourse === 'all' && (
                      <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#ef4444' }} />
                        <div style={{ paddingLeft: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#9999b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Not Enrolled Students</span>
                            <span style={{ fontSize: '18px' }}>🚫</span>
                          </div>
                          <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
                            {(bStats.notEnrolledStudents || 0).toLocaleString()}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>
                            {notEnrolledPct}% of total students
                          </div>
                          <div style={{ fontSize: '11px', color: '#9999b0', marginTop: '6px' }}>
                            Students with no active batch enrollments
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Demo Batch Card */}
                    {selectedCourse !== 'all' && bStats.demoStudents > 0 && (
                      <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#8b5cf6' }} />
                        <div style={{ paddingLeft: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#9999b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Demo Batch Students</span>
                            <span style={{ fontSize: '18px' }}>🆓</span>
                          </div>
                          <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
                            {bStats.demoStudents.toLocaleString()}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#8b5cf6', marginTop: '4px' }}>
                            {Math.round((bStats.demoStudents / totalEnrolled) * 100)}% of enrolled students
                          </div>
                          <div style={{ fontSize: '11px', color: '#9999b0', marginTop: '6px' }}>
                            Students with trial or demo access to this course
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Enrollment Ratio Visual Bar */}
                  <div style={{ background: 'var(--surface-2)', padding: '16px 20px', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px', fontWeight: 700 }}>
                      <span style={{ color: 'var(--text-primary)' }}>Total Course Enrollments Breakdown</span>
                      <span style={{ color: '#9999b0' }}>
                        {(bStats.totalLiveEnrollments + bStats.totalRecordedEnrollments).toLocaleString()} Total Enrollments
                      </span>
                    </div>
                    {(() => {
                      const totalEnr = (bStats.totalLiveEnrollments + bStats.totalRecordedEnrollments) || 1
                      const liveEnrPct = Math.round((bStats.totalLiveEnrollments / totalEnr) * 100)
                      const recEnrPct = Math.round((bStats.totalRecordedEnrollments / totalEnr) * 100)
                      return (
                        <div>
                          <div style={{ height: '12px', borderRadius: '6px', background: '#e0e3ea', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${liveEnrPct}%`, background: '#10b981', transition: 'width 0.5s ease' }} title={`Live: ${liveEnrPct}%`} />
                            <div style={{ width: `${recEnrPct}%`, background: '#f59e0b', transition: 'width 0.5s ease' }} title={`Recorded: ${recEnrPct}%`} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', fontWeight: 700 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                              <span>Live Batch: {bStats.totalLiveEnrollments} ({liveEnrPct}%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                              <span>Recorded Batch: {bStats.totalRecordedEnrollments} ({recEnrPct}%)</span>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ─── Course Growth ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>

        {/* Course Growth Table */}
        <div style={neuCard}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '20px', color: 'var(--text-primary)' }}>
            📈 Course Growth
          </h3>
          {courseGrowth.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9999b0', fontSize: '13px' }}>No data</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid #e0e3ea' }}>Course</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid #e0e3ea' }}>Total</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid #e0e3ea' }}>Today</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid #e0e3ea' }}>Growth</th>
                  </tr>
                </thead>
                <tbody>
                  {courseGrowth.map((cg: any, i: number) => (
                    <tr key={i}>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cg.courseName}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 800, textAlign: 'right' }}>
                        {cg.totalEnrollments}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 700, textAlign: 'right', color: '#6366f1' }}>
                        {cg.enrollmentCount}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 800, textAlign: 'right' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '12px', fontSize: '11px',
                          background: cg.growthDelta > 0 ? '#dcfce7' : cg.growthDelta < 0 ? '#fee2e2' : '#f3f4f6',
                          color: cg.growthDelta > 0 ? '#16a34a' : cg.growthDelta < 0 ? '#dc2626' : '#9999b0',
                        }}>
                          {cg.growthDelta > 0 ? `+${cg.growthDelta}` : cg.growthDelta}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── Term Performance & Retention Analytics ──────────────────── */}
      {data?.termAnalytics && (
        <div style={{ marginTop: '32px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                Term Performance & Revenue
              </h2>
              <p style={{ fontSize: '12px', color: '#9999b0', marginTop: '4px', fontWeight: 600 }}>
                Revenue, enrollment and student retention across academic terms
              </p>
            </div>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              style={{
                padding: '8px 18px',
                borderRadius: '50px',
                border: 'none',
                background: 'var(--surface-2)',
                color: 'var(--text-secondary)',
                boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">All Terms</option>
              {(data.termAnalytics.availableTerms || []).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* KPI Cards */}
          <div style={{ ...neuCard, marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>

              {/* Best Term */}
              <div style={{ background: 'var(--surface)', padding: '18px', borderRadius: '14px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#6366f1', borderRadius: '4px 0 0 4px' }} />
                <div style={{ paddingLeft: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#9999b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Best Term</span>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
                    {data.termAnalytics.kpis.bestTermName || 'N/A'}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#6366f1', marginTop: '4px' }}>
                    {data.termAnalytics.kpis.bestTermRevenue > 0 ? `\u20B9${data.termAnalytics.kpis.bestTermRevenue.toLocaleString('en-IN')}` : '--'}
                  </div>
                </div>
              </div>

              {/* Cumulative Revenue */}
              <div style={{ background: 'var(--surface)', padding: '18px', borderRadius: '14px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#10b981', borderRadius: '4px 0 0 4px' }} />
                <div style={{ paddingLeft: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#9999b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cumulative Revenue</span>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
                    {`\u20B9${data.termAnalytics.kpis.cumulativeRevenue.toLocaleString('en-IN')}`}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9999b0', marginTop: '4px', fontWeight: 600 }}>Across all terms</div>
                </div>
              </div>

              {/* Avg Revenue / Student */}
              <div style={{ background: 'var(--surface)', padding: '18px', borderRadius: '14px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#f59e0b', borderRadius: '4px 0 0 4px' }} />
                <div style={{ paddingLeft: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#9999b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Revenue / Student</span>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
                    {`\u20B9${data.termAnalytics.kpis.averageRevenuePerStudent.toLocaleString('en-IN')}`}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9999b0', marginTop: '4px', fontWeight: 600 }}>Per enrolled student</div>
                </div>
              </div>

              {/* Overall Retention Rate */}
              <div style={{ background: 'var(--surface)', padding: '18px', borderRadius: '14px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#8b5cf6', borderRadius: '4px 0 0 4px' }} />
                <div style={{ paddingLeft: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#9999b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retention Rate</span>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
                    {data.termAnalytics.kpis.overallRetentionRate}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#9999b0', marginTop: '4px', fontWeight: 600 }}>Students returning across terms</div>
                </div>
              </div>

              {/* Multi-Course Rate */}
              <div style={{ background: 'var(--surface)', padding: '18px', borderRadius: '14px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#ec4899', borderRadius: '4px 0 0 4px' }} />
                <div style={{ paddingLeft: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#9999b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Multi-Course Rate</span>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px' }}>
                    {data.termAnalytics.kpis.multiCoursePurchaseRate}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#9999b0', marginTop: '4px', fontWeight: 600 }}>Students buying 2+ courses</div>
                </div>
              </div>

              {/* Top Revenue Course */}
              <div style={{ background: 'var(--surface)', padding: '18px', borderRadius: '14px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#0ea5e9', borderRadius: '4px 0 0 4px' }} />
                <div style={{ paddingLeft: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#9999b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Revenue Course</span>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={data.termAnalytics.kpis.topRevenueCourse || ''}>
                    {data.termAnalytics.kpis.topRevenueCourse || 'N/A'}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0ea5e9', marginTop: '4px' }}>
                    {data.termAnalytics.kpis.topRevenueAmount > 0 ? `\u20B9${data.termAnalytics.kpis.topRevenueAmount.toLocaleString('en-IN')}` : '--'}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Term-by-Term Revenue Comparison */}
          {(data.termAnalytics.termSummaries || []).length > 0 && (
            <div style={{ ...neuCard, marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '20px', color: 'var(--text-primary)' }}>
                Term-by-Term Revenue Comparison
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.termAnalytics.termSummaries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="termName" tick={{ fontSize: 11, fontWeight: 700, fill: '#9999b0' }} tickFormatter={(v: string) => v.replace(' Term', '')} />
                  <YAxis tick={{ fontSize: 11, fill: '#9999b0' }} tickFormatter={(v: number) => `\u20B9${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`\u20B9${value.toLocaleString('en-IN')}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Retention Panel */}
          {(data.termAnalytics.retention || []).length > 0 && (
            <div style={{ ...neuCard, marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '20px', color: 'var(--text-primary)' }}>
                Student Retention Across Terms
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Term</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Total Students</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>New</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Returning</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Retention Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.termAnalytics.retention.map((r: any) => (
                      <tr key={r.termId}>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: 700 }}>{r.termName}</td>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: 800, textAlign: 'right' }}>{r.totalStudents.toLocaleString()}</td>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: 700, textAlign: 'right', color: '#0ea5e9' }}>{r.newStudents.toLocaleString()}</td>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: 700, textAlign: 'right', color: '#10b981' }}>{r.returningStudents.toLocaleString()}</td>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: 800, textAlign: 'right' }}>
                          {r.retentionRate > 0 ? (
                            <span style={{
                              padding: '3px 10px', borderRadius: '12px', fontSize: '11px',
                              background: r.retentionRate >= 50 ? '#dcfce7' : r.retentionRate >= 25 ? '#fef9c3' : '#fee2e2',
                              color: r.retentionRate >= 50 ? '#16a34a' : r.retentionRate >= 25 ? '#a16207' : '#dc2626',
                            }}>
                              {r.retentionRate}%
                            </span>
                          ) : (
                            <span style={{ color: '#9999b0', fontSize: '12px' }}>First Term</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Retention visual bar */}
              {data.termAnalytics.retention.length > 1 && (
                <div style={{ marginTop: '20px' }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.termAnalytics.retention}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="termName" tick={{ fontSize: 11, fontWeight: 700, fill: '#9999b0' }} tickFormatter={(v: string) => v.replace(' Term', '')} />
                      <YAxis tick={{ fontSize: 11, fill: '#9999b0' }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="newStudents" stackId="students" fill="#0ea5e9" name="New Students" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="returningStudents" stackId="students" fill="#10b981" name="Returning Students" radius={[6, 6, 0, 0]} />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Exam Cycle Breakdown */}
          {(data.termAnalytics.examCycleStats || []).length > 0 && (
            <div style={{ ...neuCard, marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '20px', color: 'var(--text-primary)' }}>
                Exam Stage Breakdown
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                {data.termAnalytics.examCycleStats.map((ec: any, idx: number) => {
                  const cycleColors = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6']
                  return (
                    <div key={ec.cycle} style={{ background: 'var(--surface)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: cycleColors[idx % 4], borderRadius: '4px 0 0 4px' }} />
                      <div style={{ paddingLeft: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#9999b0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ec.label}</span>
                        <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '6px' }}>
                          {`\u20B9${ec.revenue.toLocaleString('en-IN')}`}
                        </div>
                        <div style={{ fontSize: '12px', color: '#9999b0', marginTop: '4px', fontWeight: 600 }}>
                          {ec.enrollmentCount.toLocaleString()} students
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.termAnalytics.examCycleStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9999b0' }} tickFormatter={(v: number) => `\u20B9${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 11, fontWeight: 700, fill: '#9999b0' }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`\u20B9${value.toLocaleString('en-IN')}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[0, 6, 6, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Courses by Revenue */}
          {(data.termAnalytics.courseBreakdown || []).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '24px' }}>
              {/* Revenue Table */}
              <div style={neuCard}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>
                  Top Courses by Revenue
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Course</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '10px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Exam</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '10px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.termAnalytics.courseBreakdown.slice(0, 10).map((cb: any) => (
                        <tr key={`${cb.courseId}-${cb.termId}`}>
                          <td style={{ padding: '10px', fontSize: '12px', fontWeight: 700, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cb.courseName}>
                            <div>{cb.courseName}</div>
                            <div style={{ fontSize: '10px', color: '#9999b0', fontWeight: 600, marginTop: '2px' }}>{cb.termName}</div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700,
                              background: cb.examCycle === 'QUIZ_1' ? '#ede9fe' : cb.examCycle === 'QUIZ_2' ? '#d1fae5' : cb.examCycle === 'END_TERM' ? '#fef3c7' : '#f1f5f9',
                              color: cb.examCycle === 'QUIZ_1' ? '#7c3aed' : cb.examCycle === 'QUIZ_2' ? '#059669' : cb.examCycle === 'END_TERM' ? '#d97706' : '#64748b',
                            }}>{cb.examCycleLabel}</span>
                          </td>
                          <td style={{ padding: '10px', fontSize: '13px', fontWeight: 900, textAlign: 'right', color: '#6366f1' }}>
                            {`\u20B9${cb.revenue.toLocaleString('en-IN')}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Enrollment Table */}
              <div style={neuCard}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>
                  Top Courses by Students
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Course</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: '10px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Exam</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '10px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Students</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: '10px', fontWeight: 700, color: '#9999b0', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Returning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.termAnalytics.courseBreakdown].sort((a: any, b: any) => b.enrollmentCount - a.enrollmentCount).slice(0, 10).map((cb: any) => (
                        <tr key={`enr-${cb.courseId}-${cb.termId}`}>
                          <td style={{ padding: '10px', fontSize: '12px', fontWeight: 700, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cb.courseName}>
                            <div>{cb.courseName}</div>
                            <div style={{ fontSize: '10px', color: '#9999b0', fontWeight: 600, marginTop: '2px' }}>{cb.termName}</div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700,
                              background: cb.examCycle === 'QUIZ_1' ? '#ede9fe' : cb.examCycle === 'QUIZ_2' ? '#d1fae5' : cb.examCycle === 'END_TERM' ? '#fef3c7' : '#f1f5f9',
                              color: cb.examCycle === 'QUIZ_1' ? '#7c3aed' : cb.examCycle === 'QUIZ_2' ? '#059669' : cb.examCycle === 'END_TERM' ? '#d97706' : '#64748b',
                            }}>{cb.examCycleLabel}</span>
                          </td>
                          <td style={{ padding: '10px', fontSize: '13px', fontWeight: 900, textAlign: 'right' }}>
                            {cb.enrollmentCount.toLocaleString()}
                          </td>
                          <td style={{ padding: '10px', fontSize: '13px', fontWeight: 700, textAlign: 'right', color: '#10b981' }}>
                            {cb.returningStudents > 0 ? cb.returningStudents.toLocaleString() : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {(!data.termAnalytics.termSummaries || data.termAnalytics.termSummaries.length === 0) && (
            <div style={{ ...neuCard, textAlign: 'center', padding: '60px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#9999b0' }}>No term data available yet</div>
              <div style={{ fontSize: '13px', color: '#9999b0', marginTop: '8px' }}>
                Tag your courses with Academic Term and Exam Stage in the course edit modal to start seeing term insights.
              </div>
            </div>
          )}

        </div>
      )}

      {/* ─── App & Website Feedback Stats ────────────────────────── */}
      {feedbackStats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginTop: '12px' }}>
          <div style={neuCard}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '20px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📱 App & Website Feedback Statistics</span>
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              {/* App Feedback Stats Card */}
              <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(54, 54, 232, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3636e8', fontSize: '20px' }}>
                  📱
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>App Feedback</h4>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>
                      {feedbackStats.appAvg ? feedbackStats.appAvg.toFixed(1) : '0.0'}
                    </span>
                    <span style={{ fontSize: '14px', color: '#fbbf24', fontWeight: '700' }}>★</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({feedbackStats.appCount} reviews)</span>
                  </div>
                </div>
              </div>

              {/* Website Feedback Stats Card */}
              <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '20px' }}>
                  💻
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Website Feedback</h4>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>
                      {feedbackStats.webAvg ? feedbackStats.webAvg.toFixed(1) : '0.0'}
                    </span>
                    <span style={{ fontSize: '14px', color: '#fbbf24', fontWeight: '700' }}>★</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({feedbackStats.webCount} reviews)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rating distribution charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              {/* App Distribution */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '12px' }}>App Star Distribution</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[5, 4, 3, 2, 1].map(stars => {
                    const val = feedbackStats.appDist?.[stars] || 0
                    const total = feedbackStats.appCount || 1
                    const pct = Math.round((val / total) * 100)
                    return (
                      <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                        <span style={{ width: '40px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>{stars} ★</span>
                        <div style={{ flex: 1, height: '8px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#fbbf24', borderRadius: '4px' }} />
                        </div>
                        <span style={{ width: '55px', color: 'var(--text-muted)', fontWeight: 600 }}>{val} ({pct}%)</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Website Distribution */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '12px' }}>Website Star Distribution</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[5, 4, 3, 2, 1].map(stars => {
                    const val = feedbackStats.webDist?.[stars] || 0
                    const total = feedbackStats.webCount || 1
                    const pct = Math.round((val / total) * 100)
                    return (
                      <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                        <span style={{ width: '40px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>{stars} ★</span>
                        <div style={{ flex: 1, height: '8px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#fbbf24', borderRadius: '4px' }} />
                        </div>
                        <span style={{ width: '55px', color: 'var(--text-muted)', fontWeight: 600 }}>{val} ({pct}%)</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
