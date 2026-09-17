'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { normalizeMeetLink } from '@/lib/meet-link'
import { formatTimeString12Hour } from '@/lib/date-utils'
import { useRouter } from 'next/navigation'

interface CalEvent {
  id: string
  title: string
  description: string
  date: string
  time: string
  endTime?: string
  type: string
  meetLink?: string | null
  streamProvider?: string | null
  status?: string
  internalStatus?: string
  courseId?: string | null
  isGlobal?: boolean
  recurrence?: string | null
  interval?: number | null
  parentId?: string | null
  course?: { id: string; name: string; color: string } | null
  instructorId?: string | null
  instructor?: { id: string; name: string } | null
}

interface ClassOption {
  id: string
  name: string
  color: string
}

interface InstructorOption {
  id: string
  name: string
}

interface UserInfo {
  role: string
}

function buildEventDateTime(date: string, startTimeValue: string, endTimeValue: string) {
  const startTime = new Date(`${date}T${startTimeValue}:00`)
  const endTime = new Date(`${date}T${endTimeValue}:00`)

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  }
}

const TYPE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  class: { bg: 'var(--info)', color: '#ffffff', label: 'Class' }, // Vibrant Blue like Google Calendar
  exam: { bg: 'var(--danger)', color: '#ffffff', label: 'Exam' },
  assignment: { bg: '#FFC107', color: '#000000', label: 'Assignment' }, // Punchy Yellow
  event: { bg: 'var(--success)', color: '#ffffff', label: 'Event' },
  holiday: { bg: 'var(--text-secondary)', color: '#ffffff', label: 'Holiday' },
}

const EVENT_TYPES = [
  { value: 'class', label: 'Class' },
  { value: 'exam', label: 'Exam' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'event', label: 'Event' },
  { value: 'holiday', label: 'Holiday' },
]

const EVENT_STATUS_OPTIONS = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'RESCHEDULED', label: 'Rescheduled' },
]

const RECURRENCE_OPTIONS = [
  { value: 'ONETIME', label: 'One Time' },
  { value: 'WEEKDAYS', label: 'Weekdays (Mon - Fri)' },
  { value: 'DAILY', label: 'Daily (Every Day)' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'CUSTOM_DATES', label: 'Specific Custom Dates' },
  { value: 'CUSTOM', label: 'Custom Day Interval' },
]

function CalendarPageContent() {
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [mounted, setMounted] = useState(false)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [instructors, setInstructors] = useState<InstructorOption[]>([])
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState<Date | null>(null)
  const [todayState, setTodayState] = useState<Date | null>(null)

  useEffect(() => {
    setMounted(true)
    setCurrentDate(new Date())
    setTodayState(new Date())
  }, [])

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Multi-course selection state
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])
  const [isGlobalCourse, setIsGlobalCourse] = useState<boolean>(false)
  const [courseSearchQuery, setCourseSearchQuery] = useState<string>('')

  // Custom specific dates selection state
  const [customDates, setCustomDates] = useState<string[]>([])
  const [customDateInput, setCustomDateInput] = useState<string>('')

  // Bulk Manager state
  const [showBulkManager, setShowBulkManager] = useState(false)
  const [bulkFromDate, setBulkFromDate] = useState('')
  const [bulkToDate, setBulkToDate] = useState('')
  const [bulkCourseFilter, setBulkCourseFilter] = useState('')
  const [bulkTypeFilter, setBulkTypeFilter] = useState('')
  const [bulkSearch, setBulkSearch] = useState('')
  const [selectedBulkEventIds, setSelectedBulkEventIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkNotifyStudents, setBulkNotifyStudents] = useState(false)

  // Detail popover for clicking event pills on calendar
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null)
  const [selectedDailyDay, setSelectedDailyDay] = useState<number | null>(null)
  // Mobile agenda view selected day (separate from the modal-opening selectedDailyDay)
  const [mobileSelectedDay, setMobileSelectedDay] = useState<number>(() => new Date().getDate())
  const mobileDayStripRef = useRef<HTMLDivElement>(null)

  const year = currentDate?.getFullYear() || new Date().getFullYear()
  const month = currentDate?.getMonth() ?? new Date().getMonth()
  const monthName = currentDate ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''
  const isManager = user?.role === 'MANAGER' || user?.role === 'ADMIN'
  const [syncing, setSyncing] = useState(false)

  async function handleSyncLiveSessions() {
    try {
      setSyncing(true)
      const res = await fetch('/api/live-sessions/sync', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to sync live sessions')
        return
      }
      const result = await res.json()
      alert(`Success: Synced ${result.count ?? 0} live session(s) from calendar for today!`)
      loadEvents()
    } catch (error) {
      console.error(error)
      alert('Failed to sync live sessions')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    // Load user info, classes (courses only), and instructors once
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/classes?includeDms=false&activeOnly=true').then(r => r.json()),
      fetch('/api/instructors').then(r => r.json()),
    ]).then(([meData, clsData, instrData]) => {
      setUser(meData.user || meData)
      setClasses(clsData.classes || clsData || [])
      setInstructors(instrData || [])
    }).catch(console.error)
  }, [])

  useEffect(() => {
    loadEvents()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  function loadEvents() {
    setLoading(true)
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    fetch(`/api/events?month=${monthStr}`)
      .then(r => r.json())
      .then(data => setEvents(Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()

  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const isToday = (day: number) => {
    if (!todayState) return false
    return day === todayState.getDate() && month === todayState.getMonth() && year === todayState.getFullYear()
  }

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.date === dateStr)
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => setCurrentDate(new Date())

  const set = (key: string, val: string) => setFormData(prev => ({ ...prev, [key]: val }))

  function openCreate(prefilledDate?: string) {
    setEditId(null)
    const defaultDate = prefilledDate || (todayState ? `${todayState.getFullYear()}-${String(todayState.getMonth() + 1).padStart(2, '0')}-${String(todayState.getDate()).padStart(2, '0')}` : '')
    setFormData({
      title: '',
      description: '',
      date: defaultDate,
      time: '',
      endTime: '',
      type: 'class',
      courseId: '',
      instructorId: '',
      meetLink: '',
      status: 'SCHEDULED',
      recurrence: 'ONETIME',
      interval: '1',
      parentId: '',
      streamProvider: 'MEET',
      repeatUntil: '',
      rescheduledDate: defaultDate,
      rescheduledTime: '',
      rescheduledEndTime: '',
    })
    setSelectedCourseIds([])
    setIsGlobalCourse(false)
    setCourseSearchQuery('')
    setCustomDates([])
    setCustomDateInput('')
    setShowModal(true)
  }

  function openEdit(ev: CalEvent, presetReschedule?: boolean) {
    setEditId(ev.id)
    const isResched = presetReschedule || ev.internalStatus === 'RESCHEDULED'
    setFormData({
      title: ev.title || '',
      description: ev.description || '',
      date: ev.date || '',
      time: ev.time || '',
      endTime: ev.endTime || '',
      type: ev.type || 'class',
      courseId: ev.isGlobal ? 'GLOBAL' : (ev.courseId || ''),
      instructorId: ev.instructorId || '',
      meetLink: ev.meetLink || '',
      status: isResched ? 'RESCHEDULED' : (ev.internalStatus || 'SCHEDULED'),
      recurrence: ev.recurrence || 'ONETIME',
      interval: ev.interval ? String(ev.interval) : '1',
      parentId: ev.parentId || '',
      streamProvider: ev.streamProvider || 'MEET',
      repeatUntil: '',
      rescheduledDate: ev.date || '',
      rescheduledTime: ev.time || '',
      rescheduledEndTime: ev.endTime || '',
    })
    if (ev.isGlobal) {
      setIsGlobalCourse(true)
      setSelectedCourseIds([])
    } else {
      setIsGlobalCourse(false)
      setSelectedCourseIds(ev.courseId ? [ev.courseId] : [])
    }
    setCourseSearchQuery('')
    setCustomDates([])
    setCustomDateInput('')
    setSelectedEvent(null)
    setShowModal(true)
  }

  async function handleSave() {
    if (!formData.title) {
      alert('Please enter an event title')
      return
    }

    // Determine target dates and times (considering RESCHEDULED workflow)
    const isRescheduled = formData.status === 'RESCHEDULED'
    const targetDate = isRescheduled ? (formData.rescheduledDate || formData.date) : formData.date
    const targetTime = isRescheduled ? (formData.rescheduledTime || formData.time) : formData.time
    const targetEndTime = isRescheduled ? (formData.rescheduledEndTime || formData.endTime) : formData.endTime

    if (!targetDate || !targetTime || !targetEndTime) {
      alert('Please specify the date, start time, and end time.')
      return
    }

    // Validate course selection
    if (!isGlobalCourse && selectedCourseIds.length === 0) {
      alert("Please select at least one course for this event.\n\nTo make it visible to all users, select 'Global (visible to all users)'.")
      return
    }

    setSaving(true)
    try {
      const { startTime, endTime } = buildEventDateTime(targetDate, targetTime, targetEndTime)
      if (new Date(endTime) <= new Date(startTime)) {
        alert('End time must be later than start time')
        setSaving(false)
        return
      }

      const recurrence = formData.recurrence || 'ONETIME'
      const isSeriesEvent = !!formData.parentId || recurrence !== 'ONETIME'
      const streamProvider = (formData.streamProvider || 'MEET').toUpperCase()

      const payload: Record<string, any> = {
        title: formData.title,
        description: formData.description || null,
        date: targetDate,
        time: targetTime,
        startTime,
        endTime,
        meetLink: streamProvider === 'AGORA' ? null : (formData.meetLink || null),
        status: formData.status || 'SCHEDULED',
        recurrence,
        interval: recurrence === 'CUSTOM' ? (formData.interval || '1') : null,
        repeatUntil: formData.repeatUntil || null,
        customDates: recurrence === 'CUSTOM_DATES' ? customDates : [],
        type: formData.type || 'class',
        isGlobal: isGlobalCourse,
        courseId: isGlobalCourse ? null : (selectedCourseIds[0] || null),
        courseIds: isGlobalCourse ? [] : selectedCourseIds,
        instructorId: formData.instructorId || null,
        parentId: formData.parentId || null,
        streamProvider,
        relatedCourse: !isGlobalCourse && selectedCourseIds.length > 0
          ? classes.find(c => c.id === selectedCourseIds[0])?.name || null
          : null,
      }

      if (isRescheduled) {
        payload.originalStartTime = formData.date && formData.time
          ? `${formData.date}T${formData.time}:00`
          : null
      }

      const url = editId ? `/api/events/${editId}` : '/api/events'
      const method = editId ? 'PUT' : 'POST'
      let applyToFuture = false
      if (editId && isSeriesEvent) {
        applyToFuture = await confirm({
          title: 'Update Recurring Event?',
          message: 'Do you want to apply these changes to this event and all future events in the series?',
          confirmLabel: 'This & Future Events',
          cancelLabel: 'Only This Event',
          tone: 'default',
        })
      }
      const requestBody = editId && isSeriesEvent
        ? { ...payload, applyToFuture }
        : payload
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to save event')
      } else {
        setShowModal(false)
        loadEvents()
      }
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const allowed = await confirm({
      title: 'Delete Event?',
      message: 'This event will be removed from the calendar.',
      confirmLabel: 'Delete Event',
      tone: 'danger',
    })
    if (!allowed) return
    try {
      await fetch(`/api/events/${id}`, { method: 'DELETE' })
      setSelectedEvent(null)
      loadEvents()
    } catch (e) {
      console.error(e)
    }
  }

  function openBulkManager(initialFromDate?: string) {
    let from = initialFromDate
    if (!from) {
      if (todayState) {
        const d = new Date(todayState)
        d.setDate(d.getDate() + 1)
        from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      } else {
        from = `${year}-${String(month + 1).padStart(2, '0')}-17`
      }
    }
    setBulkFromDate(from)
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
    setBulkToDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`)
    setBulkCourseFilter('')
    setBulkTypeFilter('')
    setBulkSearch('')
    setBulkNotifyStudents(false)

    // Pre-select all events that match this starting date range
    const matchingIds = events
      .filter(e => e.date >= from && (!lastDayOfMonth || e.date <= `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`))
      .map(e => e.id)
    setSelectedBulkEventIds(new Set(matchingIds))
    setShowBulkManager(true)
  }

  async function handleBulkDelete() {
    if (selectedBulkEventIds.size === 0) return
    const count = selectedBulkEventIds.size
    const allowed = await confirm({
      title: `Delete ${count} Event${count > 1 ? 's' : ''}?`,
      message: `You are about to permanently delete ${count} event${count > 1 ? 's' : ''} from the calendar. This action cannot be undone.`,
      confirmLabel: `Delete ${count} Event${count > 1 ? 's' : ''}`,
      tone: 'danger',
    })
    if (!allowed) return

    setBulkDeleting(true)
    try {
      const res = await fetch('/api/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventIds: Array.from(selectedBulkEventIds),
          notifyStudents: bulkNotifyStudents,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to delete events')
      } else {
        setShowBulkManager(false)
        setSelectedBulkEventIds(new Set())
        loadEvents()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setBulkDeleting(false)
    }
  }

  // Filtered events for Bulk Manager
  const bulkFilteredEvents = events.filter(e => {
    if (bulkFromDate && e.date < bulkFromDate) return false
    if (bulkToDate && e.date > bulkToDate) return false
    if (bulkCourseFilter) {
      if (bulkCourseFilter === 'GLOBAL') {
        if (!e.isGlobal && e.courseId) return false
      } else {
        if (e.courseId !== bulkCourseFilter) return false
      }
    }
    if (bulkTypeFilter && e.type !== bulkTypeFilter) return false
    if (bulkSearch) {
      const q = bulkSearch.toLowerCase()
      const titleMatch = e.title.toLowerCase().includes(q)
      const courseMatch = e.course?.name?.toLowerCase().includes(q)
      if (!titleMatch && !courseMatch) return false
    }
    return true
  }).sort((a, b) => {
    const dComp = a.date.localeCompare(b.date)
    if (dComp !== 0) return dComp
    return (a.time || '').localeCompare(b.time || '')
  })

  // Group bulk filtered events by date
  const bulkEventsByDate = bulkFilteredEvents.reduce<Record<string, CalEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = []
    acc[ev.date].push(ev)
    return acc
  }, {})



  // Snap mobileSelectedDay to a valid range whenever month changes
  useEffect(() => {
    const totalDays = new Date(year, month + 1, 0).getDate()
    const today = todayState
    if (today && today.getFullYear() === year && today.getMonth() === month) {
      setMobileSelectedDay(today.getDate())
    } else {
      setMobileSelectedDay(prev => Math.min(prev, totalDays))
    }
  }, [year, month, todayState])

  // Auto-scroll the day strip so the selected day stays in view
  useEffect(() => {
    const el = mobileDayStripRef.current?.querySelector<HTMLElement>(`[data-day="${mobileSelectedDay}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [mobileSelectedDay])

  // On first mount (and when month/today resolves), force-scroll the day strip to today
  // so the calendar always opens centered on the current date, even if mobileSelectedDay
  // happened to already equal today's date and the scroll-on-change effect didn't fire.
  useEffect(() => {
    if (!mounted || !todayState) return
    const el = mobileDayStripRef.current?.querySelector<HTMLElement>(`[data-day="${mobileSelectedDay}"]`)
    if (el) el.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, todayState, year, month])

  if (!mounted || !currentDate) return null

  const mobileDayEvents = getEventsForDay(mobileSelectedDay).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const mobileSelectedDateLabel = new Date(year, month, mobileSelectedDay).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="page-container fade-in" style={{ padding: '32px' }}>
      {confirmDialog}

      {/* ───────────── MOBILE CALENDAR (≤768px) ───────────── */}
      <div className="calendar-mobile-only">
        {/* Premium Neumorphic Page Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px',
          justifyContent: 'flex-start'
        }}>
          <button
            onClick={() => router.back()}
            aria-label="Go Back"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--surface)',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
              color: 'var(--text-secondary)',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              fontSize: '22px',
              fontWeight: 900,
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              fontFamily: "'Outfit', 'Nunito', sans-serif"
            }}>
              Calendar
            </h1>
            <p style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              margin: '3px 0 0',
              fontFamily: "'Outfit', sans-serif"
            }}>
              Schedule, classes &amp; deadlines
            </p>
          </div>
        </div>

        {/* Month navigator */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface-2)', padding: '8px 8px 8px 18px', borderRadius: '50px',
          boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
          marginBottom: '18px',
        }}>
          <button onClick={prevMonth} aria-label="Previous month" style={{
            width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-2)', boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)', color: 'var(--primary)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={goToday} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)',
          }}>{monthName}</button>
          <button onClick={nextMonth} aria-label="Next month" style={{
            width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-2)', boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)', color: 'var(--primary)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Day strip (horizontal scroll) */}
        <div
          ref={mobileDayStripRef}
          className="calendar-mobile-day-strip"
          style={{
            display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px',
            marginBottom: '20px', WebkitOverflowScrolling: 'touch',
          }}
        >
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const dayDate = new Date(year, month, day)
            const wkLabel = WEEKDAY_LABELS[dayDate.getDay()]
            const isSelected = day === mobileSelectedDay
            const today = isToday(day)
            const eventCount = getEventsForDay(day).length
            return (
              <button
                key={`mday-${day}`}
                data-day={day}
                onClick={() => setMobileSelectedDay(day)}
                style={{
                  flex: '0 0 auto',
                  width: '54px', minHeight: '70px',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '4px', padding: '8px 6px', borderRadius: '20px',
                  background: isSelected ? 'var(--primary)' : 'var(--surface-2)',
                  color: isSelected ? '#ffffff' : (today ? 'var(--primary)' : 'var(--text-secondary)'),
                  boxShadow: isSelected
                    ? '5px 5px 12px rgba(54,54,232,0.35), -3px -3px 8px var(--neu-glow)'
                    : '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: '10px', fontWeight: 700, opacity: isSelected ? 0.85 : 1 }}>{wkLabel}</span>
                <span style={{ fontSize: '17px', fontWeight: 800 }}>{day}</span>
                {eventCount > 0 && (
                  <span style={{
                    position: 'absolute', bottom: '6px',
                    width: '5px', height: '5px', borderRadius: '50%',
                    background: isSelected ? '#ffffff' : 'var(--primary)',
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Selected day header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 4px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Schedule</div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{mobileSelectedDateLabel}</div>
          </div>
          {isManager && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={handleSyncLiveSessions}
                disabled={syncing}
                style={{
                  background: 'var(--surface-2)', color: 'var(--primary)', border: '1px solid var(--border)', cursor: syncing ? 'wait' : 'pointer',
                  borderRadius: '50%', width: '40px', height: '40px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
                  opacity: syncing ? 0.6 : 1,
                }}
                title="Sync today's scheduled classes to live sessions"
                aria-label="Sync live sessions"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
                  <path d="M21.5 2v6h-6M2 22v-6h6M21.34 15.57a10 10 0 1 1-.92-10.45l3.08 2.88L2 22l-3.08-2.88a10 10 0 1 1 .92 10.45"/>
                </svg>
              </button>
              <button
                onClick={() => {
                  const dayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(mobileSelectedDay).padStart(2, '0')}`
                  openBulkManager(dayDateStr)
                }}
                style={{
                  background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', cursor: 'pointer',
                  borderRadius: '50%', width: '40px', height: '40px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
                }}
                title="Manage and clean up events"
                aria-label="Manage events"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
              <button onClick={() => openCreate(`${year}-${String(month + 1).padStart(2, '0')}-${String(mobileSelectedDay).padStart(2, '0')}`)} style={{
                background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer',
                borderRadius: '50%', width: '40px', height: '40px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 14px rgba(54,54,232,0.4)',
              }} aria-label="Add event">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          )}
        </div>

        {/* Agenda list for selected day */}
        {mobileDayEvents.length === 0 ? (
          <div style={{
            padding: '40px 20px', textAlign: 'center', borderRadius: '24px',
            background: 'var(--surface-2)', boxShadow: 'inset 4px 4px 8px var(--neu-dark), inset -4px -4px 8px var(--neu-light)',
            color: 'var(--text-muted)',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--neu-dark)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '10px' }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Nothing scheduled</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>Enjoy your free time</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mobileDayEvents.map(ev => {
              const tc = TYPE_COLORS[ev.type] || TYPE_COLORS.class
              return (
                <div
                  key={ev.id}
                  onClick={() => {
                    if (isManager) setSelectedEvent(ev)
                  }}
                  style={{
                    display: 'flex', alignItems: 'stretch', gap: '14px',
                    padding: '14px 16px', borderRadius: '20px',
                    background: 'var(--surface)', cursor: isManager ? 'pointer' : 'default',
                    boxShadow: '6px 6px 14px var(--neu-dark), -6px -6px 14px var(--neu-light)',
                    borderLeft: `5px solid ${tc.bg}`,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '76px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{ev.time ? formatTimeString12Hour(ev.time) : '—'}</span>
                    {ev.endTime && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>to {formatTimeString12Hour(ev.endTime)}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '50px', background: tc.bg + '22', color: tc.bg === '#FFC107' ? '#b48a04' : tc.bg }}>
                        {tc.label}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.course?.name || (ev.isGlobal ? 'Global' : '')}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ───────────── DESKTOP CALENDAR (>768px) ───────────── */}
      <div className="page-header calendar-desktop-only" style={{ marginBottom: '32px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          background: 'var(--surface-2)',
          padding: '6px',
          borderRadius: '50px',
          boxShadow: 'inset 4px 4px 8px var(--border), inset -4px -4px 8px var(--neu-light)'
        }}>
          <button onClick={goToday} className="btn btn-sm" style={{ 
            background: 'transparent', 
            boxShadow: 'none',
            color: 'var(--text-primary)',
            fontWeight: '700'
          }}>Today</button>
          <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
          <button onClick={prevMonth} style={{ 
            width: '32px', height: '32px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', transition: 'all 0.2s'
          }} className="hover:bg-white/50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button onClick={nextMonth} style={{ 
            width: '32px', height: '32px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', transition: 'all 0.2s'
          }} className="hover:bg-white/50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        <h2 style={{ 
          fontSize: '26px', 
          fontWeight: '800', 
          color: 'var(--text-primary)',
          margin: 0,
          background: 'linear-gradient(135deg, var(--text-primary), var(--info))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          {monthName}
        </h2>

        {isManager && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleSyncLiveSessions}
              disabled={syncing}
              className="btn"
              style={{
                padding: '10px 20px',
                fontWeight: '700',
                background: 'var(--surface-2)',
                color: 'var(--primary)',
                border: '1px solid var(--border)',
                borderRadius: '50px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: syncing ? 'wait' : 'pointer',
                boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
                opacity: syncing ? 0.7 : 1,
              }}
              title="Sync today's scheduled classes to live sessions"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
                <path d="M21.5 2v6h-6M2 22v-6h6M21.34 15.57a10 10 0 1 1-.92-10.45l3.08 2.88L2 22l-3.08-2.88a10 10 0 1 1 .92 10.45"/>
              </svg>
              {syncing ? 'Syncing...' : 'Sync Live Sessions'}
            </button>
            <button
              onClick={() => openBulkManager()}
              className="btn"
              style={{
                padding: '10px 20px',
                fontWeight: '700',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '50px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)',
              }}
              title="Manage, select and bulk delete events after any date"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Manage &amp; Clean Up
            </button>
            <button onClick={() => openCreate()} className="btn btn-primary" style={{ padding: '10px 24px', fontWeight: '700' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Event
            </button>
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="card calendar-desktop-only" style={{
        overflow: 'hidden',
        borderRadius: '28px',
        border: '1px solid var(--border)',
        boxShadow: '20px 20px 60px var(--neu-dark), -20px -20px 60px var(--neu-light)'
      }}>
        {/* Day headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
          backdropFilter: 'blur(10px)'
        }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{
              padding: '16px 8px',
              textAlign: 'center',
              fontSize: '11px',
              fontWeight: '800',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
        }}>
          {days.map((day, i) => {
            const dayEvents = day ? getEventsForDay(day) : []
            const dayKey = day ? `day-${year}-${month}-${day}` : `empty-${i}`
            const today = day ? isToday(day) : false
            return (
              <div key={dayKey} style={{
                minHeight: '120px',
                padding: '36px 8px 8px', // Extra top padding for the date number
                borderBottom: '1px solid rgba(0,0,0,0.03)',
                borderRight: (i + 1) % 7 !== 0 ? '1px solid rgba(0,0,0,0.03)' : 'none',
                background: today ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                boxShadow: today ? 'inset 0 0 0 1.5px var(--info)' : 'none',
                transition: 'all 0.2s ease',
                cursor: day ? 'pointer' : 'default',
                position: 'relative',
              }}
              onClick={() => {
                if (day) setSelectedDailyDay(day)
              }}
              onMouseEnter={e => { 
                if (day) {
                  e.currentTarget.style.background = 'var(--surface-2)';
                  e.currentTarget.style.boxShadow = today 
                    ? 'inset 0 0 0 1.5px var(--info), inset 0 0 20px rgba(0,0,0,0.02)' 
                    : 'inset 0 0 20px rgba(0,0,0,0.02)';
                  e.currentTarget.style.zIndex = '5';
                }
              }}
              onMouseLeave={e => { 
                if (day) {
                  e.currentTarget.style.background = today ? 'rgba(59, 130, 246, 0.08)' : 'transparent';
                  e.currentTarget.style.boxShadow = today ? 'inset 0 0 0 1.5px var(--info)' : 'none';
                  e.currentTarget.style.zIndex = '1';
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (day && isManager) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  openCreate(dateStr)
                }
              }}
              >
                {day && (
                  <>
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '12px',
                      fontSize: '13px',
                      fontWeight: today ? '800' : '600',
                      color: today ? 'var(--info)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {day}
                      {today && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--info)' }} />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {dayEvents.slice(0, 4).map(ev => {
                        const tc = TYPE_COLORS[ev.type] || TYPE_COLORS.class
                        return (
                          <div key={ev.id} onClick={(e) => { 
                            e.stopPropagation(); 
                            if (isManager) setSelectedEvent(ev);
                          }} style={{
                            padding: '4px 8px',
                            borderRadius: '8px',
                            background: tc.bg,
                            color: tc.color,
                            fontSize: '10px',
                            fontWeight: '700',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: isManager ? 'pointer' : 'default',
                            boxShadow: today ? '0 0 8px rgba(255, 255, 255, 0.35)' : '0 2px 4px rgba(0,0,0,0.05)',
                            border: today ? '1.5px solid #ffffff' : '1px solid var(--border)'
                          }} title={`${ev.title}${ev.time ? ` ${ev.time}` : ''}`}>
                            {ev.title}
                          </div>
                        )
                      })}
                      {dayEvents.length > 4 && (
                        <div style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', paddingLeft: '4px', marginTop: '2px' }}>
                          + {dayEvents.length - 4} MORE
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Events This Month List */}
      <div className="calendar-desktop-only" style={{ marginTop: '40px' }}>
        <h3 style={{
          fontSize: '15px',
          fontWeight: '800',
          marginBottom: '16px',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em'
        }}>Events This Month</h3>
        {events.length === 0 ? (
          <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface-2)', backdropFilter: 'blur(10px)' }}>
            No events this month
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(() => {
              const todayDateObj = todayState || new Date()
              const todayStr = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(todayDateObj.getDate()).padStart(2, '0')}`
              
              const todayEvents = events.filter(e => e.date === todayStr)
              const otherEvents = events.filter(e => e.date !== todayStr)

              const sortByDateAndTime = (a: CalEvent, b: CalEvent) => {
                const dateCompare = a.date.localeCompare(b.date)
                if (dateCompare !== 0) return dateCompare
                return (a.time || '').localeCompare(b.time || '')
              }

              const sortedEvents = [
                ...todayEvents.sort(sortByDateAndTime),
                ...otherEvents.sort(sortByDateAndTime)
              ]

              return sortedEvents.map(ev => {
                const tc = TYPE_COLORS[ev.type] || TYPE_COLORS.class
                const isEventToday = ev.date === todayStr
                return (
                  <div key={ev.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px 24px',
                    gap: '16px',
                    borderRadius: '24px',
                    background: isEventToday 
                      ? 'linear-gradient(135deg, var(--surface) 0%, rgba(59, 130, 246, 0.07) 100%)' 
                      : 'var(--surface)',
                    boxShadow: isEventToday
                      ? '0 0 20px rgba(59, 130, 246, 0.12), 8px 8px 24px rgba(0,0,0,0.04)'
                      : '8px 8px 24px rgba(0,0,0,0.04), -8px -8px 24px var(--neu-glow)',
                    transition: 'all 0.3s ease',
                    border: isEventToday ? '1.5px solid var(--info)' : '1px solid var(--border)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = isEventToday
                      ? '0 0 25px rgba(59, 130, 246, 0.2), 12px 12px 32px rgba(0,0,0,0.06)'
                      : '12px 12px 32px rgba(0,0,0,0.06)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = isEventToday
                      ? '0 0 20px rgba(59, 130, 246, 0.12), 8px 8px 24px rgba(0,0,0,0.04)'
                      : '8px 8px 24px rgba(0,0,0,0.04), -8px -8px 24px var(--neu-glow)'
                  }}
                  >
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: tc.bg,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                    }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: tc.color, lineHeight: 1 }}>
                        {new Date(ev.date + 'T00:00:00').getDate()}
                      </span>
                      <span style={{ fontSize: '9px', color: tc.color, fontWeight: '700', textTransform: 'uppercase', opacity: 0.9 }}>
                        {new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {ev.title}
                        {isEventToday && (
                          <span style={{
                            fontSize: '9px',
                            padding: '2px 8px',
                            borderRadius: '50px',
                            fontWeight: '800',
                            background: 'var(--info)',
                            color: '#ffffff',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Today
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
                        {ev.time && `${formatTimeString12Hour(ev.time)}${ev.endTime ? ` - ${formatTimeString12Hour(ev.endTime)}` : ''} · `}
                        {ev.course?.name ? ev.course.name : ev.description || 'Global (All Users)'}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '10px', padding: '4px 12px', borderRadius: '50px', fontWeight: '700',
                      background: 'var(--bg)',
                      color: 'var(--text-secondary)',
                    }}>
                      {ev.course?.name || 'Global'}
                    </span>
                    <span style={{
                      fontSize: '10px', padding: '4px 12px', borderRadius: '50px', fontWeight: '700',
                      background: tc.bg + '20',
                      color: tc.bg === '#FFC107' ? '#b48a04' : tc.bg, // Adjust contrast for yellow
                    }}>
                      {tc.label}
                    </span>
                    {isManager && (
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => openEdit(ev)} className="btn btn-ghost btn-sm" style={{ padding: '8px', boxShadow: 'none' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(ev.id)} className="btn btn-sm" style={{ padding: '8px', color: 'var(--danger)', background: 'var(--danger-light)', boxShadow: 'none' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            })()}
          </div>
        )}
      </div>

      {/* Event Detail Popover */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 'min(440px, calc(100vw - 32px))', borderRadius: '28px' }}>
            <div className="modal-header" style={{ border: 'none', padding: '24px 24px 0' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>Event Details</h3>
              <button onClick={() => setSelectedEvent(null)} style={{ color: 'var(--text-muted)', transition: 'all 0.2s' }} className="hover:rotate-90">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Title</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{selectedEvent.title}</div>
              </div>
              {selectedEvent.description && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Description</div>
                  <div style={{ fontSize: '13px', color: '#3a3a5c' }}>{selectedEvent.description}</div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Date</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{selectedEvent.date}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Time</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    {selectedEvent.time
                      ? `${formatTimeString12Hour(selectedEvent.time)}${selectedEvent.endTime ? ` - ${formatTimeString12Hour(selectedEvent.endTime)}` : ''}`
                      : '—'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Type</div>
                  <span className={`badge badge-${selectedEvent.type === 'exam' ? 'danger' : selectedEvent.type === 'assignment' ? 'warning' : 'primary'}`}>
                    {(TYPE_COLORS[selectedEvent.type] || TYPE_COLORS.class).label}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Subject</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{selectedEvent.course?.name || 'Global (All Users)'}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{selectedEvent.internalStatus || selectedEvent.status || 'SCHEDULED'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Recurrence</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    {selectedEvent.recurrence === 'CUSTOM' && selectedEvent.interval
                      ? `Every ${selectedEvent.interval} day(s)`
                      : (selectedEvent.recurrence || 'ONETIME')}
                  </div>
                </div>
              </div>
              {selectedEvent.instructor && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Instructor</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{selectedEvent.instructor.name}</div>
                </div>
              )}
              {selectedEvent.meetLink && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Meet Link</div>
                  <a href={normalizeMeetLink(selectedEvent.meetLink) ?? '#'} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: 'var(--info)', wordBreak: 'break-all' }}>
                    {selectedEvent.meetLink}
                  </a>
                </div>
              )}
            </div>
            {isManager && (
              <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => handleDelete(selectedEvent.id)} className="btn btn-sm" style={{ color: 'var(--danger)', border: '1px solid #fee2e2' }}>
                  Delete
                </button>
                <button onClick={() => openEdit(selectedEvent, true)} className="btn btn-sm" style={{ color: '#d97706', border: '1px solid #fde68a', background: 'rgba(245, 158, 11, 0.1)', fontWeight: '600' }}>
                  Reschedule
                </button>
                <button onClick={() => openEdit(selectedEvent)} className="btn btn-primary btn-sm">
                  Edit Event
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Event Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '600' }}>
                {editId ? 'Edit Event' : 'Add Event'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  className="form-input"
                  value={formData.title || ''}
                  onChange={e => set('title', e.target.value)}
                  placeholder="Event title"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  value={formData.description || ''}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Subject / Courses *</label>
                  {!isGlobalCourse && classes.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedCourseIds(classes.map(c => c.id))}
                        style={{ fontSize: '11px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '700' }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCourseIds([])}
                        style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Global Toggle option */}
                <div
                  onClick={() => {
                    setIsGlobalCourse(!isGlobalCourse)
                    if (!isGlobalCourse) setSelectedCourseIds([])
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: isGlobalCourse ? 'rgba(59, 130, 246, 0.12)' : 'var(--surface-2)',
                    border: `1.5px solid ${isGlobalCourse ? 'var(--info)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    marginBottom: '10px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isGlobalCourse}
                    onChange={() => {}}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--info)' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: isGlobalCourse ? 'var(--info)' : 'var(--text-primary)' }}>
                      Global (visible to all users across the platform)
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Uncheck to select one or multiple specific courses below.
                    </div>
                  </div>
                </div>

                {/* Course List with Multi-Select Checkboxes */}
                {!isGlobalCourse && (
                  <div style={{
                    borderRadius: '16px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    padding: '10px 12px',
                  }}>
                    {classes.length > 5 && (
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Search courses..."
                        value={courseSearchQuery}
                        onChange={e => setCourseSearchQuery(e.target.value)}
                        style={{ fontSize: '12px', padding: '6px 10px', marginBottom: '8px' }}
                      />
                    )}
                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {classes
                        .filter(c => !courseSearchQuery || c.name.toLowerCase().includes(courseSearchQuery.toLowerCase()))
                        .map(c => {
                          const isChecked = selectedCourseIds.includes(c.id)
                          return (
                            <label
                              key={c.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '6px 8px',
                                borderRadius: '8px',
                                background: isChecked ? 'rgba(54, 54, 232, 0.08)' : 'transparent',
                                cursor: 'pointer',
                                transition: 'background 0.15s ease'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedCourseIds(selectedCourseIds.filter(id => id !== c.id))
                                  } else {
                                    setSelectedCourseIds([...selectedCourseIds, c.id])
                                  }
                                }}
                                style={{ width: '15px', height: '15px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                              />
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color || 'var(--primary)', flexShrink: 0 }} />
                              <span style={{ fontSize: '13px', fontWeight: isChecked ? '700' : '500', color: 'var(--text-primary)', flex: 1 }}>
                                {c.name}
                              </span>
                            </label>
                          )
                        })}
                    </div>
                    <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)' }}>
                        {selectedCourseIds.length} course{selectedCourseIds.length !== 1 ? 's' : ''} selected
                      </span>
                    </div>
                  </div>
                )}

                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                  {isGlobalCourse
                    ? 'This event will be visible to everyone on the platform.'
                    : '✨ Privacy: Each enrolled student will only see their own course name. They will not see that other courses were also scheduled.'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.date || ''}
                    onChange={e => set('date', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Start Time *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.time || ''}
                    onChange={e => set('time', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time *</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.endTime || ''}
                    onChange={e => set('endTime', e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Reschedule Detail Box */}
              {formData.status === 'RESCHEDULED' && (
                <div style={{
                  background: 'rgba(217, 119, 6, 0.08)',
                  border: '1.5px solid var(--warning, #f59e0b)',
                  borderRadius: '16px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📅</span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Set Rescheduled Date &amp; Time</strong>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                    Originally scheduled: <strong>{formData.date || '—'}</strong> at <strong>{formData.time ? formatTimeString12Hour(formData.time) : '—'}</strong>. Enrolled students will receive a rescheduling notification with the new date and time.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '4px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>New Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.rescheduledDate || formData.date || ''}
                        onChange={e => set('rescheduledDate', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>New Start Time *</label>
                      <input
                        type="time"
                        className="form-input"
                        value={formData.rescheduledTime || formData.time || ''}
                        onChange={e => set('rescheduledTime', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>New End Time *</label>
                      <input
                        type="time"
                        className="form-input"
                        value={formData.rescheduledEndTime || formData.endTime || ''}
                        onChange={e => set('rescheduledEndTime', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Stream Provider</label>
                <select
                  className="form-input"
                  value={formData.streamProvider || 'MEET'}
                  onChange={e => set('streamProvider', e.target.value)}
                >
                  <option value="MEET">Google Meet (paste link)</option>
                  <option value="YOUTUBE">YouTube (paste link)</option>
                  <option value="DRIVE">Google Drive (paste link)</option>
                  <option value="AGORA">In-app live class (Agora)</option>
                </select>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {formData.streamProvider === 'AGORA'
                    ? 'Students will join inside the app. No external link needed.'
                    : 'Students follow the link below to attend.'}
                </p>
              </div>
              {formData.streamProvider !== 'AGORA' && (
                <div className="form-group">
                  <label className="form-label">
                    {formData.streamProvider === 'YOUTUBE' ? 'YouTube Link'
                      : formData.streamProvider === 'DRIVE' ? 'Google Drive Link'
                      : 'Meet Link'}
                  </label>
                  <input
                    type="url"
                    className="form-input"
                    value={formData.meetLink || ''}
                    onChange={e => set('meetLink', e.target.value)}
                    placeholder={
                      formData.streamProvider === 'YOUTUBE'
                        ? 'https://www.youtube.com/watch?v=...'
                        : formData.streamProvider === 'DRIVE'
                          ? 'https://drive.google.com/file/d/.../view'
                          : 'https://meet.google.com/...'
                    }
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-input"
                  value={formData.type || 'class'}
                  onChange={e => set('type', e.target.value)}
                >
                  {EVENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-input"
                    value={formData.status || 'SCHEDULED'}
                    onChange={e => set('status', e.target.value)}
                  >
                    {EVENT_STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Recurrence</label>
                  <select
                    className="form-input"
                    value={formData.recurrence || 'ONETIME'}
                    onChange={e => set('recurrence', e.target.value)}
                  >
                    {RECURRENCE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Weekdays Notice */}
              {formData.recurrence === 'WEEKDAYS' && (
                <div style={{ padding: '8px 12px', borderRadius: '12px', background: 'rgba(54, 54, 232, 0.08)', fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>
                  🗓️ Classes will only be scheduled Monday through Friday (weekends automatically skipped).
                </div>
              )}

              {/* Repeat Until End Date for series */}
              {(formData.recurrence === 'WEEKDAYS' || formData.recurrence === 'DAILY' || formData.recurrence === 'WEEKLY' || formData.recurrence === 'CUSTOM') && (
                <div className="form-group">
                  <label className="form-label">Repeat Until (Optional End Date)</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.repeatUntil || ''}
                    onChange={e => set('repeatUntil', e.target.value)}
                    min={formData.date || undefined}
                    placeholder="YYYY-MM-DD"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {formData.repeatUntil
                      ? `Events will automatically stop repeating after ${formData.repeatUntil}.`
                      : 'Leave empty to repeat for the standard 30-day window.'}
                  </p>
                </div>
              )}

              {/* Custom Specific Dates Picker */}
              {formData.recurrence === 'CUSTOM_DATES' && (
                <div style={{ background: 'var(--surface-2)', padding: '14px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                  <label className="form-label" style={{ marginBottom: '6px' }}>Choose Specific Additional Dates</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <input
                      type="date"
                      className="form-input"
                      value={customDateInput}
                      onChange={e => setCustomDateInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        if (customDateInput && !customDates.includes(customDateInput)) {
                          setCustomDates([...customDates, customDateInput].sort())
                          setCustomDateInput('')
                        }
                      }}
                      disabled={!customDateInput}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Add Date
                    </button>
                  </div>
                  {customDates.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {customDates.map(d => (
                        <span key={d} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '4px 10px', borderRadius: '50px',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          fontSize: '12px', fontWeight: '600'
                        }}>
                          {d}
                          <button
                            type="button"
                            onClick={() => setCustomDates(customDates.filter(x => x !== d))}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', fontWeight: 'bold' }}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                      Pick dates above to schedule this class on specific chosen days at the same time.
                    </p>
                  )}
                </div>
              )}

              {/* Custom Interval */}
              {formData.recurrence === 'CUSTOM' && (
                <div className="form-group">
                  <label className="form-label">Repeat Every (Days)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={formData.interval || '1'}
                    onChange={e => set('interval', e.target.value)}
                  />
                </div>
              )}

              {instructors.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Instructor</label>
                  <select
                    className="form-input"
                    value={formData.instructorId || ''}
                    onChange={e => set('instructorId', e.target.value)}
                  >
                    <option value="">None (no instructor assigned)</option>
                    {instructors.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Optionally assign an instructor to this event.
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button
                onClick={handleSave}
                disabled={
                  saving ||
                  !formData.title ||
                  (!isGlobalCourse && selectedCourseIds.length === 0) ||
                  (formData.status === 'RESCHEDULED'
                    ? (!formData.rescheduledDate && !formData.date) || (!formData.rescheduledTime && !formData.time)
                    : !formData.date || !formData.time || !formData.endTime)
                }
                className="btn btn-primary"
              >
                {saving ? 'Saving…' : (editId ? 'Update Event' : 'Create Event')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Schedule Modal */}
      {selectedDailyDay !== null && (
        <div className="modal-overlay" onClick={() => setSelectedDailyDay(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 'min(620px, calc(100vw - 32px))', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Schedule for the Day</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {new Date(year, month, selectedDailyDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                {isManager && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextDayDate = new Date(year, month, selectedDailyDay + 1)
                      const nextDayStr = `${nextDayDate.getFullYear()}-${String(nextDayDate.getMonth() + 1).padStart(2, '0')}-${String(nextDayDate.getDate()).padStart(2, '0')}`
                      setSelectedDailyDay(null)
                      openBulkManager(nextDayStr)
                    }}
                    style={{
                      marginTop: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      padding: '5px 12px',
                      borderRadius: '50px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      boxShadow: '2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light)'
                    }}
                    title="Clean up and manage events occurring after this date"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                    Clean up events after this date
                  </button>
                )}
              </div>
              <button onClick={() => setSelectedDailyDay(null)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {(() => {
                const dayEvents = getEventsForDay(selectedDailyDay).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                if (dayEvents.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '16px', opacity: 0.5 }}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <p style={{ fontSize: '15px', fontWeight: '600' }}>No events scheduled for this day.</p>
                    </div>
                  )
                }
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {dayEvents.map(ev => {
                      const tc = TYPE_COLORS[ev.type] || TYPE_COLORS.class
                      return (
                        <div key={ev.id} style={{ 
                          border: `1px solid ${tc.bg}`, 
                          borderRadius: '16px', 
                          padding: '16px 20px',
                          background: 'var(--surface)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: tc.color }} />
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '10px' }}>
                            <div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                                <span className={`badge badge-${ev.type === 'exam' ? 'danger' : ev.type === 'assignment' ? 'warning' : 'primary'}`}>
                                  {tc.label}
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                  {ev.time ? `${formatTimeString12Hour(ev.time)}${ev.endTime ? ` - ${formatTimeString12Hour(ev.endTime)}` : ''}` : 'Time TBD'}
                                </span>
                              </div>
                              <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                                {ev.title}
                              </h4>
                            </div>

                            {isManager && (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                <button
                                  onClick={() => { setSelectedDailyDay(null); openEdit(ev, true); }}
                                  className="btn btn-sm"
                                  style={{ padding: '4px 8px', fontSize: '11px', color: '#d97706', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #fde68a', fontWeight: '700' }}
                                  title="Reschedule event"
                                >
                                  Reschedule
                                </button>
                                <button
                                  onClick={() => { setSelectedDailyDay(null); openEdit(ev); }}
                                  className="btn btn-sm btn-ghost"
                                  style={{ padding: '6px 8px' }}
                                  title="Edit event"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                                <button
                                  onClick={async () => {
                                    await handleDelete(ev.id)
                                  }}
                                  className="btn btn-sm"
                                  style={{ padding: '6px 8px', color: 'var(--danger)', background: 'var(--danger-light)' }}
                                  title="Delete event"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f1f5' }}>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</div>
                              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{ev.course?.name || 'Global'}</div>
                            </div>
                            {ev.instructor && (
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instructor</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{ev.instructor.name}</div>
                              </div>
                            )}
                          </div>
                          
                          {ev.description && (
                            <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                              {ev.description}
                            </div>
                          )}

                          {isManager && ev.meetLink && (
                            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Meeting Link (Manager Only)</div>
                              <a href={normalizeMeetLink(ev.meetLink) ?? '#'} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: 'var(--info)', fontWeight: '600', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                                {ev.meetLink}
                              </a>
                            </div>
                          )}
                          
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
            
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
              <button 
                onClick={() => setSelectedDailyDay(null)} 
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Event Manager & Cleanup Modal */}
      {showBulkManager && (
        <div className="modal-overlay" onClick={() => setShowBulkManager(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 'min(780px, calc(100vw - 32px))', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', padding: '20px 24px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>Manage &amp; Clean Up Events</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                  Filter events by date range, review matching events, uncheck any you want to keep, and delete unwanted events in bulk.
                </p>
              </div>
              <button onClick={() => setShowBulkManager(false)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Quick Date Presets */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Quick Range:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBulkFromDate(`${year}-${String(month + 1).padStart(2, '0')}-17`)
                    const lastDay = new Date(year, month + 1, 0).getDate()
                    setBulkToDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)
                  }}
                  className="btn btn-sm"
                  style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  After 16th (Rest of Month)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (todayState) {
                      const nextD = new Date(todayState)
                      nextD.setDate(nextD.getDate() + 1)
                      setBulkFromDate(`${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}-${String(nextD.getDate()).padStart(2, '0')}`)
                    }
                    const lastDay = new Date(year, month + 1, 0).getDate()
                    setBulkToDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)
                  }}
                  className="btn btn-sm"
                  style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  After Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkFromDate(`${year}-${String(month + 1).padStart(2, '0')}-01`)
                    const lastDay = new Date(year, month + 1, 0).getDate()
                    setBulkToDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)
                  }}
                  className="btn btn-sm"
                  style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  Entire Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkFromDate('')
                    setBulkToDate('')
                  }}
                  className="btn btn-sm"
                  style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  All Dates
                </button>
              </div>

              {/* Filters Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '10px',
                padding: '12px',
                borderRadius: '16px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)'
              }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>From Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={bulkFromDate}
                    onChange={e => setBulkFromDate(e.target.value)}
                    style={{ fontSize: '12px', padding: '6px 8px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>To Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={bulkToDate}
                    onChange={e => setBulkToDate(e.target.value)}
                    style={{ fontSize: '12px', padding: '6px 8px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Course</label>
                  <select
                    className="form-input"
                    value={bulkCourseFilter}
                    onChange={e => setBulkCourseFilter(e.target.value)}
                    style={{ fontSize: '12px', padding: '6px 8px' }}
                  >
                    <option value="">All Courses</option>
                    <option value="GLOBAL">Global Events Only</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Type</label>
                  <select
                    className="form-input"
                    value={bulkTypeFilter}
                    onChange={e => setBulkTypeFilter(e.target.value)}
                    style={{ fontSize: '12px', padding: '6px 8px' }}
                  >
                    <option value="">All Types</option>
                    {EVENT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Search Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Keyword..."
                    value={bulkSearch}
                    onChange={e => setBulkSearch(e.target.value)}
                    style={{ fontSize: '12px', padding: '6px 8px' }}
                  />
                </div>
              </div>

              {/* Selection Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: '12px',
                background: selectedBulkEventIds.size > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface)',
                border: `1px solid ${selectedBulkEventIds.size > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                    <input
                      type="checkbox"
                      checked={bulkFilteredEvents.length > 0 && selectedBulkEventIds.size === bulkFilteredEvents.length}
                      onChange={() => {
                        if (selectedBulkEventIds.size === bulkFilteredEvents.length) {
                          setSelectedBulkEventIds(new Set())
                        } else {
                          setSelectedBulkEventIds(new Set(bulkFilteredEvents.map(e => e.id)))
                        }
                      }}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--danger)', cursor: 'pointer' }}
                    />
                    Select All ({bulkFilteredEvents.length})
                  </label>
                  {selectedBulkEventIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedBulkEventIds(new Set())}
                      style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: selectedBulkEventIds.size > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                  {selectedBulkEventIds.size} of {bulkFilteredEvents.length} selected for deletion
                </div>
              </div>

              {/* Events List Grouped by Date */}
              <div style={{
                maxHeight: '340px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                paddingRight: '4px'
              }}>
                {bulkFilteredEvents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600' }}>No events found matching your filter criteria.</p>
                    <p style={{ fontSize: '12px', marginTop: '4px' }}>Try adjusting your date range or search keyword.</p>
                  </div>
                ) : (
                  Object.entries(bulkEventsByDate).map(([dateStr, dateEvs]) => {
                    const allDateSelected = dateEvs.every(e => selectedBulkEventIds.has(e.id))
                    const formattedDateHeader = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })

                    return (
                      <div key={dateStr} style={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
                        {/* Date Subheader with Group Select */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 14px',
                          background: 'var(--surface-2)',
                          borderBottom: '1px solid var(--border)',
                        }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            <input
                              type="checkbox"
                              checked={allDateSelected}
                              onChange={() => {
                                const nextSet = new Set(selectedBulkEventIds)
                                if (allDateSelected) {
                                  dateEvs.forEach(e => nextSet.delete(e.id))
                                } else {
                                  dateEvs.forEach(e => nextSet.add(e.id))
                                }
                                setSelectedBulkEventIds(nextSet)
                              }}
                              style={{ width: '14px', height: '14px', accentColor: 'var(--danger)', cursor: 'pointer' }}
                            />
                            {formattedDateHeader} ({dateEvs.length} event{dateEvs.length !== 1 ? 's' : ''})
                          </label>
                        </div>

                        {/* Event Rows */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {dateEvs.map((ev, idx) => {
                            const isSelected = selectedBulkEventIds.has(ev.id)
                            const tc = TYPE_COLORS[ev.type] || TYPE_COLORS.class

                            return (
                              <div
                                key={ev.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  padding: '10px 14px',
                                  borderBottom: idx < dateEvs.length - 1 ? '1px solid rgba(0,0,0,0.03)' : 'none',
                                  background: isSelected ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                                  transition: 'background 0.15s ease',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    const nextSet = new Set(selectedBulkEventIds)
                                    if (isSelected) {
                                      nextSet.delete(ev.id)
                                    } else {
                                      nextSet.add(ev.id)
                                    }
                                    setSelectedBulkEventIds(nextSet)
                                  }}
                                  style={{ width: '15px', height: '15px', accentColor: 'var(--danger)', cursor: 'pointer' }}
                                />
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  background: 'var(--surface-2)',
                                  color: 'var(--text-secondary)',
                                  minWidth: '65px',
                                  textAlign: 'center'
                                }}>
                                  {ev.time ? formatTimeString12Hour(ev.time) : '—'}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {ev.title}
                                  </div>
                                </div>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '2px 8px',
                                  borderRadius: '50px',
                                  fontWeight: '700',
                                  background: tc.bg + '20',
                                  color: tc.bg === '#FFC107' ? '#b48a04' : tc.bg,
                                  flexShrink: 0
                                }}>
                                  {tc.label}
                                </span>
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  color: 'var(--text-muted)',
                                  maxWidth: '120px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}>
                                  {ev.course?.name || (ev.isGlobal ? 'Global' : '—')}
                                </span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await handleDelete(ev.id)
                                  }}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                  title="Delete only this event"
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                  </svg>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Notification toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px' }}>
                <input
                  type="checkbox"
                  id="bulkNotify"
                  checked={bulkNotifyStudents}
                  onChange={e => setBulkNotifyStudents(e.target.checked)}
                  style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <label htmlFor="bulkNotify" style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Send cancellation notifications to enrolled students (recommended off when cleaning test or duplicate series)
                </label>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setShowBulkManager(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting || selectedBulkEventIds.size === 0}
                className="btn"
                style={{
                  background: 'var(--danger)',
                  color: '#ffffff',
                  fontWeight: '700',
                  padding: '10px 24px',
                  borderRadius: '50px',
                  opacity: (bulkDeleting || selectedBulkEventIds.size === 0) ? 0.5 : 1,
                  cursor: (bulkDeleting || selectedBulkEventIds.size === 0) ? 'not-allowed' : 'pointer',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
                }}
              >
                {bulkDeleting ? 'Deleting…' : `Delete ${selectedBulkEventIds.size} Selected Event${selectedBulkEventIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default dynamic(() => Promise.resolve(CalendarPageContent), { ssr: false })
