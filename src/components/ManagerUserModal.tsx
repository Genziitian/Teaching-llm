'use client'

import { useState, useEffect } from 'react'
import { mutate } from 'swr'
import { useRouter } from 'next/navigation'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { getDefaultAvatar } from '@/lib/avatar'
import { isCourseExpired } from '@/lib/course-state'
import UserAvatar from '@/components/UserAvatar'
import SocialCardModal from '@/components/SocialCardModal'

interface CourseInfo {
  id: string
  name: string
  color: string
  subject?: string
  expiresAt?: string | null
  isDisabled?: boolean
  isExpired?: boolean
  isEffectivelyDisabled?: boolean
}

interface CourseBundleInfo {
  id: string
  name: string
  courses?: { course: CourseInfo }[]
}

interface User {
  id: string
  name: string
  firstName?: string | null
  lastName?: string | null
  mobileNumber?: string | null
  email: string
  role: string
  securityNumber?: string | null
  createdAt: string
  gender?: string
  age?: number | null
  state?: string | null
  avatar?: string | null
  isGoogleUser?: boolean
  notificationGroupEmails?: string | null
  enrollments?: { courseId: string; type?: string; course: CourseInfo }[]
  instructorAssignments?: { courseId: string; course: CourseInfo }[]
  courseBundleAssignments?: { bundleId: string; bundle: CourseBundleInfo }[]
  enableDetailedLogs?: boolean
  deletionRequestedAt?: string | null
  deletionRequestReason?: string | null
}

interface ManagerUserModalProps {
  userId: string | null
  onClose?: () => void
  onUpdate?: () => void
  mode?: 'modal' | 'page'
}

export default function ManagerUserModal({ userId, onClose, onUpdate, mode = 'modal' }: ManagerUserModalProps) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const router = useRouter()
  const [user, setUser] = useState<User|null>(null)
  const [courses, setCourses] = useState<CourseInfo[]>([])
  const [bundles, setBundles] = useState<CourseBundleInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isMaximized, setIsMaximized] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    firstName: '',
    lastName: '',
    mobileNumber: '',
    email: '',
    role: '',
    gender: 'MALE',
    courseIds: [] as string[],
    bundleIds: [] as string[],
    enrollmentTypes: {} as Record<string, string>, // courseId → 'LIVE' | 'RECORDED'
    notificationGroupEmails: [] as string[],
    age: '',
    state: '',
    enableDetailedLogs: false,
    iitmJoinYear: '',
    iitmJoinMonth: '',
    iitmLevel: '',
    iitmUserType: '',
    isIdentityUpdated: false
  })
  const [showSocialCard, setShowSocialCard] = useState(false)
  const bundledCourseIds = new Set(
    bundles
      .filter(bundle => formData.bundleIds.includes(bundle.id))
      .flatMap(bundle => (bundle.courses || []).map(entry => entry.course.id))
  )

  function normalizeCollection<T>(value: unknown, nestedKey?: string): T[] {
    if (Array.isArray(value)) return value as T[]
    if (nestedKey && value && typeof value === 'object') {
      const nested = (value as Record<string, unknown>)[nestedKey]
      if (Array.isArray(nested)) return nested as T[]
    }
    return []
  }

  function getSafeDisplayName(data: Partial<User> | null | undefined) {
    const fullName = data?.name?.trim()
    if (fullName) return fullName
    const composedName = [data?.firstName?.trim(), data?.lastName?.trim()].filter(Boolean).join(' ')
    return composedName || 'Unknown User'
  }

  function parseDate(value?: string) {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  useEffect(() => {
    if (userId) {
      loadUser(userId)
      loadCourses()
      loadBundles()
    }
  }, [userId])

  async function loadUser(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${id}?t=${Date.now()}`)
      const data = await res.json()
      if (res.ok) {
        const normalizedUser = {
          ...data,
          name: getSafeDisplayName(data),
          enrollments: normalizeCollection(data?.enrollments),
          instructorAssignments: normalizeCollection(data?.instructorAssignments),
          courseBundleAssignments: normalizeCollection(data?.courseBundleAssignments),
        }
        const notifEmails = data.notificationGroupEmails
          ? data.notificationGroupEmails.split(',').map((e: string) => e.trim()).filter(Boolean)
          : []
        setUser(normalizedUser)
        setFormData({
            name: normalizedUser.name,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            mobileNumber: data.mobileNumber || '',
            email: data.email || '',
            role: data.role || '',
            gender: data.gender || 'MALE',
            age: data.age?.toString() || '',
            state: data.state || '',
            courseIds: normalizeCollection<any>(data?.enrollments).map((e: any) => e.courseId),
            bundleIds: normalizeCollection<any>(data?.courseBundleAssignments).map((b: any) => b.bundleId),
            enrollmentTypes: Object.fromEntries(
              normalizeCollection<any>(data?.enrollments).map((e: any) => [e.courseId, e.type || 'LIVE'])
            ),
            notificationGroupEmails: notifEmails,
            enableDetailedLogs: data.enableDetailedLogs || false,
            iitmJoinYear: data.iitmJoinYear || '',
            iitmJoinMonth: data.iitmJoinMonth || '',
            iitmLevel: data.iitmLevel || '',
            iitmUserType: data.iitmUserType || '',
            isIdentityUpdated: data.isIdentityUpdated || false
        })
      } else {
        setUser(null)
        setError(data?.error || 'Failed to load user')
      }
    } catch (e) {
      console.error(e)
      setUser(null)
      setError('Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  async function loadCourses() {
    try {
      const res = await fetch('/api/courses')
      const data = await res.json()
      setCourses(normalizeCollection<CourseInfo>(data, 'courses'))
    } catch (e) {
      console.error(e)
      setCourses([])
    }
  }

  async function loadBundles() {
    try {
      const res = await fetch('/api/course-bundles')
      const data = await res.json()
      setBundles(normalizeCollection<CourseBundleInfo>(data, 'bundles'))
    } catch (e) {
      console.error(e)
      setBundles([])
    }
  }

  const handleClose = () => {
    if (onClose) {
      onClose()
    } else {
      router.push('/admin')
    }
  }

  async function handleUpdate() {
    if (!userId) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: formData.name,
            firstName: formData.firstName,
            lastName: formData.lastName,
            mobileNumber: formData.mobileNumber,
            email: formData.email,
            role: formData.role,
            gender: formData.gender,
            age: formData.age ? parseInt(formData.age, 10) : null,
            state: formData.state,
            courseIds: formData.courseIds,
            bundleIds: formData.bundleIds,
            enrollmentTypes: formData.enrollmentTypes,
            notificationGroupEmails: formData.notificationGroupEmails.join(','),
            iitmJoinYear: formData.iitmJoinYear || null,
            iitmJoinMonth: formData.iitmJoinMonth || null,
            iitmLevel: formData.iitmLevel || null,
            iitmUserType: formData.iitmUserType || null,
            isIdentityUpdated: formData.isIdentityUpdated,
            ...('enableDetailedLogs' in (user || {}) ? { enableDetailedLogs: formData.enableDetailedLogs } : {})
        }),
      })
      if (res.ok) {
        mutate('/api/users')
        mutate('/api/auth/me')
        mutate('/api/dashboard')
        router.refresh()
        onUpdate?.()
        handleClose()
      } else {
        const d = await res.json()
        setError(d.error || 'Failed to update')
      }
    } catch (e) {
      setError('Connection error')
    } finally {
      setSaving(false)
    }
  }



  if (!userId) {
    if (mode === 'page') {
      return (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          User ID not provided.
        </div>
      )
    }
    return null
  }

  const displayName = getSafeDisplayName({ name: formData.name, firstName: formData.firstName, lastName: formData.lastName }) || getSafeDisplayName(user)
  const createdAtDate = parseDate(user?.createdAt)
  const createdAtLabel = createdAtDate
    ? createdAtDate.toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Unknown'
  const isRecentlyCreated = createdAtDate
    ? (Date.now() - createdAtDate.getTime()) <= 10 * 24 * 60 * 60 * 1000
    : false
  const displayInitial = displayName.charAt(0).toUpperCase() || '?'
  const isExpiredCourse = (course: CourseInfo) => Boolean(course.isExpired || isCourseExpired(course))
  const isAssignableCourse = (course: CourseInfo) => !course.isDisabled && !course.isEffectivelyDisabled && !isExpiredCourse(course)

  const neuBox = {
    background: 'var(--surface)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    borderRadius: '16px',
    padding: '24px',
  }

  const neuInset = {
    background: 'var(--surface)',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    padding: '10px 14px',
    outline: 'none',
    width: '100%',
    minWidth: 0,
    fontSize: '13px',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  }

  const renderInnerContent = () => (
    <>
      <div className="manager-profile-layout">
              {/* Left Column: Profile & Personal Details */}
              <div className="manager-profile-left">
                <div className="manager-profile-header" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                  <UserAvatar
                    className="manager-profile-avatar"
                    user={{ name: displayName, avatar: user.avatar, gender: formData.gender || user.gender }}
                    size={90}
                    style={{ border: '3px solid var(--border)', boxShadow: '4px 4px 10px var(--neu-dark), -4px -4px 10px var(--neu-light)' }}
                  />
                  <div className="manager-profile-header-text" style={{ textAlign: 'left' }}>
                    <h2 className="manager-profile-name" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>{displayName}</h2>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {(formData.role || user.role).charAt(0) + (formData.role || user.role).slice(1).toLowerCase()} Account
                      {(formData.role || user.role) !== 'STUDENT' && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                    <div className="manager-profile-auth-badges" style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                      {user.isGoogleUser && (
                        <span className="manager-profile-badge" style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '4px 12px', borderRadius: '20px',
                          background: 'linear-gradient(135deg, var(--info-light), var(--border))',
                          border: '1px solid #c6d9f1',
                          fontSize: '10px', fontWeight: '700', color: '#4285f4'
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          Authenticated
                        </span>
                      )}
                      {isRecentlyCreated && (
                        <span style={{
                          fontSize: '10px', fontWeight: '700', color: '#065f46',
                          background: 'linear-gradient(135deg, var(--success-light), var(--border))', padding: '4px 12px', borderRadius: '20px',
                          border: '1px solid #86efac',
                        }}>
                          NEWBIE
                        </span>
                      )}
                      {user.deletionRequestedAt && (
                        <span className="manager-profile-badge" style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '4px 12px', borderRadius: '20px',
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          fontSize: '10px', fontWeight: '700', color: 'var(--danger, #ef4444)'
                        }}>
                          ⚠️ DELETION REQUESTED ({new Date(user.deletionRequestedAt).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {user.deletionRequestedAt && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    marginBottom: '20px',
                    fontSize: '12.5px',
                    color: 'var(--danger, #ef4444)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>
                      User requested permanent account deletion on <strong>{new Date(user.deletionRequestedAt).toLocaleString()}</strong>.
                    </span>
                  </div>
                )}

                <div className="manager-profile-section manager-profile-personal">
                  <div className="manager-profile-grid">
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Full Name</label>
                      <input style={neuInset} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Email Address</label>
                      <input style={neuInset} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                  </div>

                  <div className="manager-profile-grid">
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>First Name</label>
                      <input style={neuInset} value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value, name: `${e.target.value} ${formData.lastName}`.trim()})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Last Name</label>
                      <input style={neuInset} value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value, name: `${formData.firstName} ${e.target.value}`.trim()})} />
                    </div>
                  </div>

                  <div className="manager-profile-grid manager-profile-grid-compact">
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Mobile Number</label>
                      <input style={neuInset} value={formData.mobileNumber} onChange={e => setFormData({...formData, mobileNumber: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{
                          width: '100%',
                          minHeight: '38px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          fontWeight: '800',
                          letterSpacing: '0.02em',
                          textTransform: 'uppercase',
                          background: 'var(--surface-3)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          boxShadow: 'none',
                          transition: 'all 0.2s ease',
                        }}
                        onClick={() => setShowSocialCard(true)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', flexShrink: 0 }}>
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        View Social Card
                      </button>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Age</label>
                      <input style={neuInset} type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>State</label>
                      <input style={neuInset} value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
                    </div>
                  </div>
                </div>

                {/* Group Mail Section */}
                <div className="manager-profile-section manager-profile-group-mail" style={{ marginBottom: '20px', padding: '16px', borderRadius: '12px', background: 'var(--surface-2)', border: '1px solid var(--border-light)' }}>
                  <div className="manager-profile-section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
                      📢 Group Mail
                    </label>
                    <a href="/google-sync" style={{ fontSize: '11px', color: 'var(--primary)', textDecoration: 'none', fontWeight: '700' }}>
                      Pools →
                    </a>
                  </div>

                  <div className="manager-mail-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {formData.notificationGroupEmails.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No Group Mail assigned yet. (Auto-assigns on save)
                      </span>
                    ) : (
                      formData.notificationGroupEmails.map(mail => (
                        <span className="manager-mail-pill" key={mail} style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          background: 'var(--primary-light, #e0e7ff)',
                          color: 'var(--primary, #4338ca)',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          flexWrap: 'wrap',
                          minWidth: 0,
                          border: '1px solid var(--border)',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}>
                          ✉️ {mail}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="manager-mail-controls" style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. notifications-group-1@genziitian.org"
                      id="managerModalNotifGroupInput"
                      style={{ flex: 1, minWidth: 0, fontSize: '12px' }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const val = (e.currentTarget.value || '').trim().toLowerCase()
                          if (val && !formData.notificationGroupEmails.includes(val)) {
                            setFormData(p => ({ ...p, notificationGroupEmails: Array.from(new Set([...p.notificationGroupEmails, val])) }))
                            e.currentTarget.value = ''
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', fontSize: '11px', fontWeight: '700' }}
                      onClick={() => {
                        const input = document.getElementById('managerModalNotifGroupInput') as HTMLInputElement
                        const val = (input?.value || '').trim().toLowerCase()
                        if (val && !formData.notificationGroupEmails.includes(val)) {
                          setFormData(p => ({ ...p, notificationGroupEmails: Array.from(new Set([...p.notificationGroupEmails, val])) }))
                          input.value = ''
                        }
                      }}
                    >
                      + Add Group Mail
                    </button>
                  </div>
                </div>

                {/* IITM Details Grid */}
                <div className="manager-profile-section manager-profile-iitm manager-profile-grid" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '20px' }}>
                  <div className="manager-profile-grid-span-2" style={{ gridColumn: 'span 2' }}>
                    <h4 style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-primary)', textTransform: 'uppercase', margin: 0 }}>IITM Identity Details</h4>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Join Year</label>
                    <select style={neuInset} value={formData.iitmJoinYear} onChange={e => setFormData({...formData, iitmJoinYear: e.target.value})}>
                      <option value="">Select Year</option>
                      <option value="2023">2023</option>
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Join Month</label>
                    <select style={neuInset} value={formData.iitmJoinMonth} onChange={e => setFormData({...formData, iitmJoinMonth: e.target.value})}>
                      <option value="">Select Month</option>
                      <option value="JAN">JAN</option>
                      <option value="MAY">MAY</option>
                      <option value="SEPT">SEPT</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>IITM Level</label>
                    <select style={neuInset} value={formData.iitmLevel} onChange={e => setFormData({...formData, iitmLevel: e.target.value})}>
                      <option value="">Select Level</option>
                      <option value="Qualifier">Qualifier</option>
                      <option value="Foundation">Foundation</option>
                      <option value="Diploma">Diploma</option>
                      <option value="Degree">Degree</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>IITM Category</label>
                    <select style={neuInset} value={formData.iitmUserType} onChange={e => setFormData({...formData, iitmUserType: e.target.value})}>
                      <option value="">Select Category</option>
                      <option value="STANDALONE">STANDALONE</option>
                      <option value="DUAL DEGREE">DUAL DEGREE</option>
                      <option value="WORKING PROFESSIONAL">WORKING PROFESSIONAL</option>
                    </select>
                  </div>
                  
                  <div className="manager-profile-grid-span-2 manager-identity-checkbox" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <input
                      type="checkbox"
                      id="isIdentityUpdated"
                      checked={formData.isIdentityUpdated}
                      onChange={e => setFormData({...formData, isIdentityUpdated: e.target.checked})}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="isIdentityUpdated" style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      Identity Questionnaire Completed (isIdentityUpdated)
                    </label>
                  </div>
                </div>

                <div className="manager-profile-section manager-profile-created" style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Account Created</label>
                  <div style={neuInset}>{createdAtLabel}</div>
                </div>

              </div>

              {/* Right Column: Security + Course Assignments */}
              <div className="manager-profile-right" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Gender Preference */}
                <div className="manager-profile-section manager-profile-gender">
                  <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>Gender Preference</label>
                  <div className="manager-gender-options" style={{ display: 'flex', gap: '10px' }}>
                    {(['MALE', 'FEMALE', 'OTHER'] as const).map(g => (
                      <label className="manager-gender-option" key={g} style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '10px', borderRadius: '16px',
                        background: formData.gender === g
                          ? g === 'MALE' ? 'var(--primary-light)' : g === 'FEMALE' ? 'rgba(236,72,153,0.16)' : 'rgba(168,85,247,0.16)'
                          : 'var(--surface)',
                        boxShadow: formData.gender === g
                          ? g === 'MALE' ? 'inset 3px 3px 6px rgba(99,102,241,0.18), inset -3px -3px 6px var(--neu-light)'
                          : g === 'FEMALE' ? 'inset 3px 3px 6px rgba(236,72,153,0.14), inset -3px -3px 6px var(--neu-light)'
                          : 'inset 3px 3px 6px rgba(168,85,247,0.14), inset -3px -3px 6px var(--neu-light)'
                          : '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                        cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '700', transition: 'all 0.2s'
                      }}>
                        <input type="radio" checked={formData.gender === g} onChange={() => setFormData({ ...formData, gender: g })} />
                        {g.charAt(0) + g.slice(1).toLowerCase()}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Security ID */}
                <div className="manager-profile-section manager-profile-security" style={{
                  padding: '20px', borderRadius: '20px',
                  background: 'linear-gradient(135deg, var(--surface-2), var(--surface))',
                  boxShadow: 'inset 4px 4px 10px var(--neu-dark), inset -4px -4px 10px var(--neu-light)',
                  border: '1px solid var(--border)'
                }}>
                  <div className="manager-profile-section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Security Identification</div>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--accent)', background: 'var(--primary-light)', padding: '3px 10px', borderRadius: '50px' }}>SECURE ACCESS</span>
                  </div>
                  <div className="manager-security-value" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
                    {user.securityNumber || 'NOT ASSIGNED'}
                  </div>
                </div>

                {user && 'enableDetailedLogs' in user && (
                  <div className="manager-profile-section manager-profile-tracking" style={{
                    padding: '20px', borderRadius: '20px', marginTop: '24px',
                    background: 'linear-gradient(135deg, var(--border), var(--surface-2))',
                    boxShadow: 'inset 4px 4px 10px var(--neu-dark), inset -4px -4px 10px var(--neu-light)',
                    border: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Stealth Tracking</div>
                      <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--accent)', background: 'var(--primary-light)', padding: '3px 10px', borderRadius: '50px' }}>SUPER ADMIN</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <div style={{ position: 'relative' }}>
                          <input type="checkbox" className="sr-only" checked={formData.enableDetailedLogs} onChange={e => setFormData({ ...formData, enableDetailedLogs: e.target.checked })} style={{ opacity: 0, width: 0, height: 0 }} />
                          <div style={{
                            display: 'block', width: '48px', height: '28px', borderRadius: '9999px',
                            background: formData.enableDetailedLogs ? 'var(--accent)' : 'var(--text-muted)', transition: 'background 0.3s'
                          }}></div>
                          <div style={{
                            position: 'absolute', top: '2px', left: '2px', width: '24px', height: '24px',
                            backgroundColor: 'var(--surface)', borderRadius: '50%', transition: 'transform 0.3s',
                            transform: formData.enableDetailedLogs ? 'translateX(20px)' : 'translateX(0)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}></div>
                        </div>
                      </label>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {formData.enableDetailedLogs ? 'Detailed Tracking Enabled' : 'Normal Tracking'}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.4 }}>
                      When enabled, this user's every click is silently logged and visible only to Super Admins.
                    </div>
                  </div>
                )}

                {formData.role !== 'MANAGER' ? (
                  <>
                    <div className="manager-profile-section manager-profile-bundles" style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '16px', display: 'block' }}>Subject Bundles</label>
                      <div className="manager-chip-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {bundles.filter(bundle => formData.bundleIds.includes(bundle.id)).map(bundle => (
                          <div className="manager-chip" key={bundle.id} style={{
                            padding: '10px 18px', borderRadius: '16px', background: 'var(--primary-light)',
                            boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                            display: 'flex', alignItems: 'center', gap: '10px'
                          }}>
                            <span className="manager-chip-label" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)' }}>{bundle.name}</span>
                            <button
                              onClick={() => setFormData({...formData, bundleIds: formData.bundleIds.filter(id => id !== bundle.id)})}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        ))}

                        <div className="manager-add-wrapper" style={{ position: 'relative' }}>
                          <select
                            onChange={(e) => {
                              if (e.target.value && !formData.bundleIds.includes(e.target.value)) {
                                setFormData({...formData, bundleIds: [...formData.bundleIds, e.target.value]})
                              }
                            }}
                            className="manager-add-select"
                            style={{
                              padding: '10px 18px', borderRadius: '16px', border: '2px dashed #ddd6fe', background: 'var(--surface-2)',
                              fontSize: '13px', fontWeight: '700', color: 'var(--accent)', cursor: 'pointer', appearance: 'none'
                            }}
                            value=""
                          >
                            <option value="">+ Add Bundle</option>
                            {bundles.filter(bundle => !formData.bundleIds.includes(bundle.id)).map(bundle => (
                              <option key={bundle.id} value={bundle.id}>{bundle.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="manager-profile-courses-wrap" style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {/* Regular Course Enrollments */}
                      <div className="manager-profile-section manager-profile-courses">
                        <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '16px', display: 'block' }}>Course Enrollments</label>
                        <div className="manager-course-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {courses.filter(c => formData.courseIds.includes(c.id) && formData.enrollmentTypes[c.id] !== 'DEMO').map(c => {
                            const enrollType = formData.enrollmentTypes[c.id] || 'LIVE'
                            const isLive = enrollType === 'LIVE'
                            const expired = isExpiredCourse(c)
                            return (
                            <div className="manager-course-pill" key={c.id} style={{
                              padding: '10px 18px', borderRadius: '16px', background: 'var(--surface)',
                              boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                              display: 'flex', alignItems: 'center', gap: '10px'
                            }}>
                               <div className="manager-course-dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.color }} />
                               <span className="manager-course-name" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{c.name}</span>
                               {expired && <span className="manager-status-badge" style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: '700', background: '#ffedd5', padding: '2px 8px', borderRadius: '20px' }}>EXPIRED</span>}
                               {c.isEffectivelyDisabled && !expired && <span className="manager-status-badge" style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '700', background: 'var(--danger-light)', padding: '2px 8px', borderRadius: '20px' }}>Disabled</span>}
                               {/* Live/Recorded Dropdown */}
                               <select
                                  className="manager-status-select"
                                  value={enrollType}
                                  onChange={(e) => {
                                    setFormData({...formData, enrollmentTypes: {...formData.enrollmentTypes, [c.id]: e.target.value}})
                                  }}
                                  style={{
                                    padding: '4px 10px', borderRadius: '20px', border: '1px solid ' + (isLive ? 'var(--border)' : 'var(--border)'),
                                    background: isLive
                                      ? 'linear-gradient(135deg, var(--success-light), var(--border))'
                                      : 'linear-gradient(135deg, var(--border), var(--border))',
                                    color: isLive ? 'var(--success)' : 'var(--warning)',
                                    fontSize: '10px', fontWeight: '800', letterSpacing: '0.04em',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    boxShadow: '2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)',
                                    outline: 'none',
                                  }}
                                >
                                  <option value="LIVE">🟢 LIVE</option>
                                  <option value="RECORDED">🟡 RECORDED</option>
                                </select>
                               <button 
                                  onClick={() => {
                                    const newTypes = {...formData.enrollmentTypes}
                                    delete newTypes[c.id]
                                    setFormData({...formData, courseIds: formData.courseIds.filter(id => id !== c.id), enrollmentTypes: newTypes})
                                  }}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}
                               >
                                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                               </button>
                            </div>
                            )
                          })}
                          
                          <div className="manager-add-wrapper" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ position: 'relative', width: '100%' }}>
                               <select 
                                  className="manager-add-select"
                                  onChange={(e) => {
                                   if (e.target.value && !formData.courseIds.includes(e.target.value)) {
                                      setFormData({
                                         ...formData,
                                         courseIds: [...formData.courseIds, e.target.value],
                                         enrollmentTypes: {...formData.enrollmentTypes, [e.target.value]: 'LIVE'}
                                       })
                                    }
                                  }}
                                style={{
                                  padding: '10px 18px', borderRadius: '16px', border: '2px dashed var(--neu-dark)', background: 'var(--surface-2)',
                                  fontSize: '13px', fontWeight: '700', color: 'var(--accent)', cursor: 'pointer', appearance: 'none'
                                }}
                                value=""
                             >
                               <option value="">+ Add Course</option>
                               {courses.filter(c => !formData.courseIds.includes(c.id) && !bundledCourseIds.has(c.id) && isAssignableCourse(c)).map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                               ))}
                             </select>
                           </div>
                          </div>
                        </div>
                        {bundledCourseIds.size > 0 && (
                          <div className="manager-bundled-note" style={{ marginTop: '14px', fontSize: '12px', color: 'var(--accent)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            Bundled courses are automatically handled.
                          </div>
                        )}
                      </div>

                      {/* Demo Courses Section */}
                      <div className="manager-profile-section manager-profile-demo-courses">
                        <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '16px', display: 'block' }}>Demo Courses</label>
                        <div className="manager-course-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {courses.filter(c => formData.courseIds.includes(c.id) && formData.enrollmentTypes[c.id] === 'DEMO').map(c => {
                            const expired = isExpiredCourse(c)
                            return (
                            <div className="manager-course-pill" key={c.id} style={{
                              padding: '10px 18px', borderRadius: '16px', background: 'var(--surface)',
                              boxShadow: '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)',
                              display: 'flex', alignItems: 'center', gap: '10px'
                            }}>
                               <div className="manager-course-dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.color }} />
                               <span className="manager-course-name" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{c.name}</span>
                               <span className="manager-status-badge" style={{ fontSize: '10px', fontWeight: '850', color: 'var(--accent)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Demo</span>
                               {expired && <span className="manager-status-badge" style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: '700', background: '#ffedd5', padding: '2px 8px', borderRadius: '20px' }}>EXPIRED</span>}
                               <button 
                                  onClick={() => {
                                    const newTypes = {...formData.enrollmentTypes}
                                    delete newTypes[c.id]
                                    setFormData({...formData, courseIds: formData.courseIds.filter(id => id !== c.id), enrollmentTypes: newTypes})
                                  }}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}
                                >
                                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                               </button>
                            </div>
                            )
                          })}
                          
                          <div className="manager-add-wrapper" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ position: 'relative', width: '100%' }}>
                               <select 
                                  className="manager-add-select"
                                  onChange={(e) => {
                                   if (e.target.value && !formData.courseIds.includes(e.target.value)) {
                                      setFormData({
                                         ...formData,
                                         courseIds: [...formData.courseIds, e.target.value],
                                         enrollmentTypes: {...formData.enrollmentTypes, [e.target.value]: 'DEMO'}
                                       })
                                    }
                                  }}
                                style={{
                                  padding: '10px 18px', borderRadius: '16px', border: '2px dashed var(--neu-dark)', background: 'var(--surface-2)',
                                  fontSize: '13px', fontWeight: '700', color: 'var(--accent)', cursor: 'pointer', appearance: 'none'
                                }}
                                value=""
                             >
                               <option value="">+ Add Demo Course</option>
                               {courses.filter(c => !formData.courseIds.includes(c.id) && isAssignableCourse(c)).map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                               ))}
                             </select>
                           </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="manager-profile-section manager-profile-manager-controls" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', borderRadius: '24px', border: '2px dashed var(--border)', padding: '40px', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '32px', marginBottom: '16px' }}>🛡️</div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Manager Controls</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Managers have global access and don't require individual course enrollments.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="manager-profile-footer" style={{ display: 'flex', gap: '20px', marginTop: '40px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '32px' }}>
              <button onClick={handleClose} style={{ flex: 1, padding: '16px', borderRadius: '20px', border: 'none', background: 'transparent', fontWeight: '700', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px' }}>Cancel</button>
              <button 
                onClick={handleUpdate}
                disabled={saving}
                style={{ 
                  flex: 1.5, padding: '16px', borderRadius: '20px', border: 'none', 
                  background: 'linear-gradient(135deg, #6366f1, #3636e8)', 
                  fontWeight: '700', color: '#fff', cursor: 'pointer',
                  boxShadow: '0 8px 16px rgba(54,54,232,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  fontSize: '15px', transition: 'all 0.2s'
                }}>
                {saving ? 'Updating...' : <>Update Profile <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>}
              </button>
            {showSocialCard && userId && (
              <SocialCardModal
                userId={userId}
                onClose={() => setShowSocialCard(false)}
              />
            )}
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center', marginTop: '20px', fontWeight: '600' }}>{error}</p>}
            <style jsx>{`
              .manager-profile-overlay {
                overflow-x: hidden;
                padding:
                  max(20px, env(safe-area-inset-top, 0px))
                  max(20px, env(safe-area-inset-right, 0px))
                  max(20px, env(safe-area-inset-bottom, 0px))
                  max(20px, env(safe-area-inset-left, 0px)) !important;
              }

              .manager-user-modal,
              .manager-user-page-card {
                box-sizing: border-box;
                overflow-x: hidden;
              }

              .manager-user-modal {
                overscroll-behavior: contain;
              }

              .manager-user-modal :global(*),
              .manager-user-page-card :global(*) {
                min-width: 0;
              }

              .manager-profile-action-btn:hover,
              .manager-profile-close:hover {
                background: var(--surface-2) !important;
                color: var(--text-primary) !important;
                transform: translateY(-1px);
              }

              .manager-profile-layout {
                display: grid;
                grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
                gap: 40px;
              }

              .manager-profile-left,
              .manager-profile-right,
              .manager-profile-courses-wrap {
                min-width: 0;
              }

              .manager-profile-left {
                display: block;
              }

              .manager-profile-right,
              .manager-profile-courses-wrap {
                display: flex;
                flex-direction: column;
                gap: 24px;
              }

              .manager-profile-header-text,
              .manager-profile-section {
                min-width: 0;
                max-width: 100%;
              }

              .manager-profile-name,
              .manager-chip-label,
              .manager-course-name,
              .manager-mail-pill,
              .manager-security-value {
                overflow-wrap: anywhere;
                word-break: break-word;
              }

              .manager-profile-grid {
                display: grid;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                gap: 20px;
                margin-bottom: 20px;
              }

              .manager-chip-list,
              .manager-course-list {
                align-items: stretch;
              }

              .manager-chip,
              .manager-course-pill {
                max-width: 100%;
                flex-wrap: wrap;
              }

              .manager-course-dot {
                flex: 0 0 10px;
              }

              .manager-course-name {
                flex: 1 1 120px;
              }

              .manager-status-badge,
              .manager-status-select {
                flex: 0 0 auto;
              }

              .manager-add-wrapper,
              .manager-add-select {
                max-width: 100%;
              }

              .manager-add-select {
                min-width: 0;
              }

              .manager-mail-pill {
                max-width: 100%;
                white-space: normal;
              }

              @media (max-width: 1100px) {
                .manager-profile-layout {
                  gap: 28px;
                }

                .manager-user-modal {
                  padding: 28px !important;
                }
              }

              @media (max-width: 900px) {
                .manager-profile-overlay {
                  align-items: stretch !important;
                }

                .manager-user-modal {
                  max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 40px) !important;
                }

                .manager-profile-layout {
                  grid-template-columns: minmax(0, 1fr);
                  gap: 18px;
                }

                .manager-profile-left,
                .manager-profile-right,
                .manager-profile-courses-wrap {
                  display: contents !important;
                }

                .manager-profile-header { order: 1; }
                .manager-profile-gender { order: 2; }
                .manager-profile-personal { order: 3; }
                .manager-profile-security { order: 4; }
                .manager-profile-group-mail { order: 5; }
                .manager-profile-iitm { order: 6; }
                .manager-profile-bundles { order: 7; }
                .manager-profile-courses { order: 8; }
                .manager-profile-demo-courses { order: 9; }
                .manager-profile-tracking { order: 10; }
                .manager-profile-manager-controls { order: 10; }
                .manager-profile-created { order: 11; }

                .manager-profile-header {
                  padding-right: 48px;
                }

                .manager-profile-section {
                  margin-bottom: 0 !important;
                }

                .manager-profile-tracking {
                  margin-top: 0 !important;
                }

                .manager-profile-grid {
                  gap: 16px;
                }
              }

              @media (max-width: 560px) {
                .manager-profile-overlay {
                  padding:
                    max(8px, env(safe-area-inset-top, 0px))
                    max(8px, env(safe-area-inset-right, 0px))
                    max(8px, env(safe-area-inset-bottom, 0px))
                    max(8px, env(safe-area-inset-left, 0px)) !important;
                }

                .manager-user-modal {
                  width: 100% !important;
                  max-width: 100% !important;
                  max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 16px) !important;
                  padding: 18px !important;
                  border-radius: 18px !important;
                }

                .manager-profile-close {
                  top: 12px !important;
                  right: 12px !important;
                  width: 34px !important;
                  height: 34px !important;
                }

                .manager-profile-layout {
                  gap: 16px;
                }

                .manager-profile-header {
                  gap: 12px !important;
                  align-items: flex-start !important;
                  margin-bottom: 0 !important;
                  padding-right: 40px;
                }

                :global(.manager-profile-avatar) {
                  width: 64px !important;
                  height: 64px !important;
                }

                .manager-profile-name {
                  font-size: 20px !important;
                  line-height: 1.15;
                }

                .manager-profile-badge {
                  max-width: 100%;
                }

                .manager-gender-options {
                  display: grid !important;
                  grid-template-columns: repeat(3, minmax(0, 1fr));
                  gap: 8px !important;
                }

                .manager-gender-option {
                  padding: 9px 6px !important;
                  gap: 5px !important;
                  border-radius: 14px !important;
                  font-size: 12px !important;
                }

                .manager-profile-grid {
                  grid-template-columns: minmax(0, 1fr);
                  gap: 14px;
                  margin-bottom: 14px;
                }

                .manager-profile-grid-compact {
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .manager-profile-grid-span-2 {
                  grid-column: 1 / -1 !important;
                }

                .manager-profile-section-heading {
                  align-items: flex-start !important;
                  gap: 8px;
                  flex-wrap: wrap;
                }

                .manager-security-value {
                  font-size: 17px !important;
                  line-height: 1.35;
                  letter-spacing: 0.04em !important;
                }

                .manager-mail-controls,
                .manager-profile-footer {
                  flex-direction: column;
                }

                .manager-mail-controls :global(.btn),
                .manager-profile-footer button {
                  width: 100%;
                  justify-content: center;
                }

                .manager-chip-list,
                .manager-course-list {
                  flex-direction: column;
                }

                .manager-chip,
                .manager-course-pill,
                .manager-add-wrapper,
                .manager-add-select {
                  width: 100%;
                }

                .manager-course-pill {
                  padding: 12px !important;
                }

                .manager-status-select {
                  max-width: 100%;
                }

                .manager-bundled-note {
                  align-items: flex-start !important;
                }

                .manager-identity-checkbox {
                  align-items: flex-start !important;
                }
              }

              @media (max-width: 340px) {
                .manager-user-modal {
                  padding: 14px !important;
                }

                .manager-profile-grid-compact,
                .manager-gender-options {
                  grid-template-columns: minmax(0, 1fr);
                }

                .manager-profile-header {
                  gap: 10px !important;
                }

                :global(.manager-profile-avatar) {
                  width: 58px !important;
                  height: 58px !important;
                }
              }
            `}</style>
    </>
  )

  if (mode === 'page') {
    return (
      <div className="manager-user-page-container" style={{
        maxWidth: '1240px',
        margin: '0 auto',
        padding: '24px 20px 60px',
        minHeight: '100%',
        boxSizing: 'border-box'
      }}>
        {confirmDialog}

        {/* Page Navigation & Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-ghost"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back to Users
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
              <span onClick={() => router.push('/admin')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Admin</span>
              <span>/</span>
              <span>Users</span>
              <span>/</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>{displayName}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-ghost"
              style={{
                padding: '10px 20px',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '13px',
                color: 'var(--text-secondary)'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={saving}
              className="btn btn-primary"
              style={{
                padding: '10px 24px',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #6366f1, #3636e8)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)'
              }}
            >
              {saving ? 'Updating...' : <>Update Profile <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>}
            </button>
          </div>
        </div>

        {/* Content Card */}
        <div className="card manager-user-page-card" style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '36px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
          position: 'relative'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>Loading user data...</div>
          ) : !user ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>User not found</div>
          ) : (
            renderInnerContent()
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="manager-profile-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: isMaximized ? 'var(--bg, #0f172a)' : 'rgba(15, 23, 42, 0.45)',
        backdropFilter: isMaximized ? 'none' : 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMaximized ? 0 : '20px',
        overflow: isMaximized ? 'hidden' : 'auto'
      }}
      onClick={isMaximized ? undefined : handleClose}
    >
      {confirmDialog}

      <div
        className="modal manager-user-modal"
        style={{
          width: isMaximized ? '100vw' : '100%',
          maxWidth: isMaximized ? '100vw' : '1000px',
          height: isMaximized ? '100vh' : 'auto',
          maxHeight: isMaximized ? '100vh' : '95vh',
          borderRadius: isMaximized ? 0 : '24px',
          overflowY: 'auto',
          position: 'relative',
          padding: isMaximized ? '40px 48px' : '32px',
          boxSizing: 'border-box'
        }}
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>Loading...</div>
        ) : !user ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>User not found</div>
        ) : (
          <>
            <div style={{
              position: 'absolute',
              top: isMaximized ? '24px' : '20px',
              right: isMaximized ? '32px' : '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 10
            }}>
              <button
                type="button"
                className="manager-profile-action-btn"
                onClick={() => router.push(`/admin/users/${userId}`)}
                title="Open in Dedicated Full Page"
                style={{
                  width: '36px', height: '36px', borderRadius: '50%', border: 'none',
                  background: 'var(--surface)', cursor: 'pointer',
                  color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s'
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>

              <button
                type="button"
                className="manager-profile-action-btn"
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? "Restore Size" : "Maximize to Full Screen"}
                style={{
                  width: '36px', height: '36px', borderRadius: '50%', border: 'none',
                  background: 'var(--surface)', cursor: 'pointer',
                  color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s'
                }}
              >
                {isMaximized ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="manager-profile-close"
                onClick={handleClose}
                title="Close"
                style={{
                  width: '36px', height: '36px', borderRadius: '50%', border: 'none',
                  background: 'var(--surface)', cursor: 'pointer',
                  color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {renderInnerContent()}
          </>
        )}
      </div>
    </div>
  )
}
