'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import useSWR, { mutate } from 'swr'
import ManagerUserModal from '@/components/ManagerUserModal'
import UserAvatar from '@/components/UserAvatar'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

interface CourseInfo {
  id: string
  name: string
  color: string
  subject?: string
  isDisabled?: boolean
  isExpired?: boolean
  isEffectivelyDisabled?: boolean
}

interface Enrollment {
  courseId: string
  course: CourseInfo
}

interface InstructorAssignment {
  courseId: string
  course: CourseInfo
}

interface CourseBundleInfo {
  id: string
  name: string
  description?: string | null
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
  isTerminated: boolean
  canTerminate: boolean
  gender?: string
  avatar?: string | null
  securityNumber?: string | null
  createdAt: string
  isGoogleUser?: boolean
  notificationGroupEmails?: string | null
  isNotificationGroupPending?: boolean
  enrollments?: Enrollment[]
  instructorAssignments?: InstructorAssignment[]
  courseBundleAssignments?: { bundleId: string; bundle: CourseBundleInfo }[]
  isSuperManager?: boolean
  deletionRequestedAt?: string | null
  deletionRequestReason?: string | null
}



export default function AdminPage() {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [courses, setCourses] = useState<CourseInfo[]>([])
  const [userRole, setUserRole] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all')


  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    return () => clearTimeout(handler)
  }, [searchQuery])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ 
    name: '', firstName: '', lastName: '', mobileNumber: '', email: '', password: '', role: 'STUDENT', gender: 'MALE',
    courseIds: [] as string[], bundleIds: [] as string[], assignedCourseIds: [] as string[],
    notificationGroupEmails: [] as string[],
    enrollmentTypes: {} as Record<string, string>,
    canTerminate: false, canCreateStudents: false 
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [editingUserIsSuperManager, setEditingUserIsSuperManager] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkEmailsText, setBulkEmailsText] = useState('')
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkImportError, setBulkImportError] = useState('')
  const [bulkImportResult, setBulkImportResult] = useState<null | {
    summary: { total: number; created: number; skippedExisting: number; invalid: number; failed: number }
    created: Array<{ email: string; securityNumber: string; name: string }>
    skippedExisting: string[]
    invalid: string[]
    failed: Array<{ email: string; error: string }>
  }>(null)

  function getDisplayName(user: Partial<User>) {
    const fullName = user.name?.trim()
    if (fullName) return fullName
    const composedName = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean).join(' ')
    return composedName || 'Unknown User'
  }

  function getInitials(name: string) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length === 0) return '?'
    return parts.map(part => part[0]).join('').toUpperCase().slice(0, 2)
  }

  function parseDate(value?: string) {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  function normalizeCollection<T>(value: unknown, nestedKey?: string): T[] {
    if (Array.isArray(value)) return value as T[]
    if (nestedKey && value && typeof value === 'object') {
      const nested = (value as Record<string, unknown>)[nestedKey]
      if (Array.isArray(nested)) return nested as T[]
    }
    return []
  }


  useEffect(() => {
    loadUsers()
    loadCourses()
    loadUserRole()
  }, [])

  async function loadUserRole() {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      const role = data.user?.role || ''
      if (role && role !== 'MANAGER') {
        window.location.href = '/dashboard'
        return
      }
      setUserRole(role)
    } catch (e) {
      console.error(e)
    }
  }

  async function loadCourses() {
    try {
      const res = await fetch('/api/courses?activeOnly=true')
      const data = await res.json()
      setCourses(normalizeCollection<CourseInfo>(data, 'courses'))
    } catch (e) {
      console.error(e)
      setCourses([])
    }
  }

  // Build the SWR key: include both search and courseId to fetch the correct data from the server
  const getUsersApiKey = () => {
    const params = new URLSearchParams()
    if (debouncedSearchQuery) {
      params.append('search', debouncedSearchQuery)
    }
    if (selectedCourseId !== 'all') {
      params.append('courseId', selectedCourseId)
    }
    const query = params.toString()
    return query ? `/api/users?${query}` : '/api/users'
  }
  const usersApiKey = getUsersApiKey()

  const { data: usersData, mutate: mutateUsers, isLoading: usersLoading } = useSWR(usersApiKey, url => fetch(url).then(r => r.json()))
  const { data: bundlesData } = useSWR(userRole === 'MANAGER' ? '/api/course-bundles' : null, url => fetch(url).then(r => r.json()))
  const { data: deletionRequestsData } = useSWR(userRole === 'MANAGER' ? '/api/admin/deletion-requests' : null, url => fetch(url).then(r => r.json()))

  const users = normalizeCollection<User>(usersData, 'users')
  const isLimitedView = usersData?.limited ?? false
  const bundles = normalizeCollection<CourseBundleInfo>(bundlesData, 'bundles')
  const managerCount = users.filter(u => u.role === 'MANAGER').length
  const bundledCourseIds = new Set(
    bundles
      .filter((bundle: CourseBundleInfo) => form.bundleIds.includes(bundle.id))
      .flatMap((bundle: CourseBundleInfo) => (bundle.courses || []).map(entry => entry.course.id))
  )

  useEffect(() => {
    loadCourses()
    loadUserRole()
  }, [])

  // Compatibility function for old code
  const loadUsers = useCallback(() => mutateUsers(), [mutateUsers])



  function openCreate() {
    setEditId(null)
    setEditingUserIsSuperManager(false)
    setForm({ 
      name: '', firstName: '', lastName: '', mobileNumber: '', email: '', password: '', role: 'STUDENT', gender: 'MALE',
      courseIds: [], bundleIds: [], assignedCourseIds: [],
      notificationGroupEmails: [],
      enrollmentTypes: {},
      canTerminate: false, canCreateStudents: false 
    })
    setError('')
    setShowModal(true)
  }

  function openEdit(user: User) {
    const displayName = getDisplayName(user)
    const [firstFallback = '', ...restFallback] = displayName.split(' ')
    if (user.isSuperManager) {
      setEditingUserIsSuperManager(true)
    } else {
      setEditingUserIsSuperManager(false)
    }
    const notifEmails = user.notificationGroupEmails
      ? user.notificationGroupEmails.split(',').map(e => e.trim()).filter(Boolean)
      : []
    setEditId(user.id)
    setForm({
      name: displayName,
      firstName: user.firstName || firstFallback,
      lastName: user.lastName || restFallback.join(' '),
      mobileNumber: user.mobileNumber || '',
      email: user.email,
      password: '',
      role: user.role,
      gender: user.gender || 'MALE',
      courseIds: user.enrollments?.map(e => e.courseId) || [],
      bundleIds: user.courseBundleAssignments?.map(b => b.bundleId) || [],
      assignedCourseIds: user.instructorAssignments?.map(a => a.courseId) || [],
      notificationGroupEmails: notifEmails,
      enrollmentTypes: user.enrollments?.reduce((acc: any, e) => {
        acc[e.courseId] = (e as any).type || 'LIVE'
        return acc
      }, {}) || {},
      canTerminate: (user as any).canTerminate || false,
      canCreateStudents: (user as any).canCreateStudents || false,
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    const derivedName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()

    if (!derivedName || !form.email) {
      setError('First name, last name, and email are required')
      return
    }

    setSaving(true)
    setError('')
    try {
      const url = editId ? `/api/users/${editId}` : '/api/users'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = { 
        name: derivedName,
        firstName: form.firstName,
        lastName: form.lastName,
        mobileNumber: form.mobileNumber,
        email: form.email,
        role: form.role,
        gender: form.gender,
        courseIds: form.courseIds,
        bundleIds: form.bundleIds,
        notificationGroupEmails: form.notificationGroupEmails.join(','),
        enrollmentTypes: form.enrollmentTypes,
        canTerminate: form.canTerminate,
        canCreateStudents: form.canCreateStudents
      }
      // For edit mode: signal password reset if requested
      if (editId && form.password === 'RESET') body.password = 'RESET'
      if (form.role === 'INSTRUCTOR') body.assignedClassIds = form.assignedCourseIds

      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to save')
        setSaving(false)
        return
      }

      setShowModal(false)
      // Show generated password if returned
      if (data.tempPassword) {
        setGeneratedPassword(data.tempPassword)
        setPasswordCopied(false)
        setShowPasswordModal(true)
      }
      loadUsers()
    } catch (e) {
      setError('Something went wrong')
    }
    setSaving(false)
  }


  async function handleBulkImport() {
    if (!bulkEmailsText.trim()) {
      setBulkImportError('Paste at least one email')
      return
    }
    setBulkImporting(true)
    setBulkImportError('')
    setBulkImportResult(null)
    try {
      const res = await fetch('/api/users/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bulkEmailsText }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBulkImportError(data.error || 'Import failed')
        setBulkImporting(false)
        return
      }
      setBulkImportResult(data)
      if (data.summary?.created > 0) {
        loadUsers()
      }
    } catch (e) {
      setBulkImportError('Something went wrong')
    }
    setBulkImporting(false)
  }

  function openBulkImport() {
    setBulkEmailsText('')
    setBulkImportError('')
    setBulkImportResult(null)
    setShowBulkImport(true)
  }

  function copyPassword() {
    navigator.clipboard.writeText(generatedPassword)
    setPasswordCopied(true)
    setTimeout(() => setPasswordCopied(false), 2000)
  }

  async function handleDelete(id: string) {
    const allowed = await confirm({
      title: 'Delete User?',
      message: 'This permanently deletes the user account.',
      confirmLabel: 'Delete User',
      tone: 'danger',
    })
    if (!allowed) return
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to delete')
        return
      }
      loadUsers()
    } catch (e) {
      console.error(e)
    }
  }

  async function handleToggleTerminate(user: User) {
    const action = user.isTerminated ? 'restore' : 'terminate'
    const allowed = await confirm({
      title: user.isTerminated ? 'Restore User?' : 'Terminate User?',
      message: `Are you sure you want to ${action} ${user.name}'s account?`,
      confirmLabel: user.isTerminated ? 'Restore User' : 'Terminate User',
      tone: user.isTerminated ? 'default' : 'danger',
    })
    if (!allowed) return

    setTogglingId(user.id)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTerminated: !user.isTerminated }),
      })
      if (res.ok) {
        mutateUsers()
      } else {
        const data = await res.json()
        alert(data.error || `Failed to ${action} user`)
      }
    } catch (e) {
      console.error(e)
    }
    setTogglingId(null)
  }

  async function handleDismissDeletionRequest(user: User) {
    const allowed = await confirm({
      title: 'Dismiss Deletion Request?',
      message: `Are you sure you want to dismiss the deletion request for ${getDisplayName(user)}?`,
      confirmLabel: 'Dismiss Request',
      tone: 'default',
    })
    if (!allowed) return

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletionRequestedAt: null }),
      })
      if (res.ok) {
        mutateUsers()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to dismiss deletion request')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const roleColors: Record<string, { bg: string; color: string }> = {
    MANAGER: { bg: 'var(--primary-light)', color: 'var(--accent)' },
    ADMIN: { bg: 'var(--info-light)', color: 'var(--info)' },
    INSTRUCTOR: { bg: 'var(--warning-light)', color: 'var(--warning)' },
    STUDENT: { bg: 'var(--success-light)', color: 'var(--success)' },
  }

  // Filter users by role tab and course — server already handles course/search filtering,
  // but we keep a safeguard check for courseId to support immediate UI filter transitions.
  const visibleUsers = users
  const filtered = visibleUsers.filter(u => {
    if (filter === 'DELETION_REQUESTS') {
      if (!u.deletionRequestedAt) return false
    } else if (filter !== 'all' && u.role !== filter) {
      return false
    }
    if (selectedCourseId !== 'all') {
      const isEnrolled = (u.enrollments || []).some(e => e.courseId === selectedCourseId)
      const isInstructor = (u.instructorAssignments || []).some(a => a.courseId === selectedCourseId)
      if (!isEnrolled && !isInstructor) return false
    }
    return true
  })

  const counts = {
    all: visibleUsers.length,
    MANAGER: visibleUsers.filter(u => u.role === 'MANAGER').length,
    ADMIN: visibleUsers.filter(u => u.role === 'ADMIN').length,
    INSTRUCTOR: visibleUsers.filter(u => u.role === 'INSTRUCTOR').length,
    STUDENT: visibleUsers.filter(u => u.role === 'STUDENT').length,
    DELETION_REQUESTS: visibleUsers.filter(u => !!u.deletionRequestedAt).length,
  }

  const pendingDeleteCount = deletionRequestsData?.counts?.pending ?? counts.DELETION_REQUESTS

  const filterTabs = [
    { label: 'All Users', key: 'all', color: 'var(--accent)', bg: 'var(--primary-light)' },
    ...(userRole === 'MANAGER' ? [
      { label: 'Managers', key: 'MANAGER', color: 'var(--accent)', bg: 'var(--primary-light)' },
    ] : []),
    ...(userRole === 'MANAGER' ? [
      { label: 'Admins', key: 'ADMIN', color: 'var(--info)', bg: 'var(--info-light)' },
    ] : []),
    { label: 'Students', key: 'STUDENT', color: 'var(--success)', bg: 'var(--success-light)' },
  ]

  return (
    <div className="page-container fade-in">
      {confirmDialog}

      <>
      <div className="page-header">
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: '300px', display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 20px', borderRadius: '50px', background: 'var(--surface-2)',
          boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9999b0" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search by Name, Email, Security No. or Mobile"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: 'none', border: 'none', width: '100%', outline: 'none',
              fontSize: '14px', color: 'var(--text-primary)',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        <div style={{
          minWidth: '220px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 18px',
          borderRadius: '50px',
          background: 'var(--surface-2)',
          boxShadow: 'inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9999b0" strokeWidth="2">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
          </svg>
          <select
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              width: '100%',
              outline: 'none',
              fontSize: '14px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Courses</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>
        {userRole === 'MANAGER' && (
          <button
            onClick={() => {
              const rows = [['Name', 'Email', 'Role', 'Courses', 'Joined']]
              filtered.forEach(u => {
                const courses = (u.enrollments || []).map(e => e.course.name).join('; ')
                rows.push([
                  getDisplayName(u), u.email, u.role, courses,
                  new Date(u.createdAt).toLocaleDateString('en-GB'),
                  new Date(u.createdAt).toLocaleDateString('en-GB'),
                ])
              })
              const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href = url; a.download = 'users_export.csv'; a.click()
              URL.revokeObjectURL(url)
            }}
            className="btn btn-ghost"
            style={{ borderRadius: '50px', padding: '0 20px', fontSize: '13px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        )}
        {userRole === 'MANAGER' && (
          <button
            onClick={openBulkImport}
            className="btn btn-ghost"
            style={{ borderRadius: '50px', padding: '0 20px', fontSize: '13px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Bulk Import
          </button>
        )}
        {userRole === 'MANAGER' && (
          <button onClick={openCreate} className="btn btn-primary" style={{ borderRadius: '50px', padding: '0 28px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add User
          </button>
        )}
        {userRole === 'MANAGER' && (
          <Link
            href="/admin/deletion-requests"
            className="btn btn-ghost"
            style={{
              borderRadius: '50px',
              padding: '0 20px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: pendingDeleteCount > 0 ? '1.5px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
              color: pendingDeleteCount > 0 ? '#ef4444' : 'var(--text-primary)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete Requests
            {pendingDeleteCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '1px 7px',
                  borderRadius: '10px',
                }}
              >
                {pendingDeleteCount}
              </span>
            )}
          </Link>
        )}
      </div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: '20px' }}>
        {filterTabs.map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className="card"
            style={{
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              cursor: 'pointer',
              border: filter === s.key ? `2px solid ${s.color}` : '1px solid #d8dae3',
              transition: 'all 0.15s',
              textAlign: 'left',
            }}
          >
            <div style={{
              width: '42px', height: '42px', borderRadius: '10px', background: s.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color,
              fontSize: '18px', fontWeight: '700', flexShrink: 0,
            }}>
              {counts[s.key as keyof typeof counts]}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{s.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {s.key === 'all' ? 'Total registered' : `${s.label} role`}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Search hint banner — shown when no search query is active */}
      {isLimitedView && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 18px', marginBottom: '12px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #eff6ff, var(--border))',
          border: '1px solid var(--border)', fontSize: '13px', color: '#3730a3',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Showing 500 most recently enrolled users. <strong style={{ marginLeft: 4 }}>Search by name, email, security number, or mobile to find anyone.</strong>
        </div>
      )}

      {/* Users List */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {usersLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading users...</div>
        ) : (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(user => {
              const rc = roleColors[user.role] || roleColors.STUDENT
              const displayName = getDisplayName(user)
              const initials = getInitials(displayName)
              const createdAtDate = parseDate(user.createdAt)
              const isNewUser = createdAtDate
                ? (Date.now() - createdAtDate.getTime()) <= 10 * 24 * 60 * 60 * 1000
                : false
              const createdAtLabel = createdAtDate
                ? createdAtDate.toLocaleDateString('en-GB', { month: '2-digit', day: '2-digit', year: 'numeric' })
                : 'Unknown'
              return (
                <div key={user.id} className="admin-user-row" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '12px 20px',
                  borderRadius: '50px',
                  background: user.isTerminated ? 'rgba(239,68,68,0.04)' : 'var(--surface-2)',
                  boxShadow: '6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)',
                  transition: 'box-shadow 0.2s',
                  opacity: user.isTerminated ? 0.7 : 1,
                  flexWrap: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '8px 8px 16px var(--neu-dark), -8px -8px 16px var(--neu-light)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)')}
                >
                  <UserAvatar
                    user={{ name: displayName, avatar: user.avatar, gender: user.gender }}
                    size={40}
                    style={{ boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link 
                      href={`/admin/users/${user.id}`}
                      style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {displayName}
                      {user.gender && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '400' }}>({user.gender})</span>
                      )}
                      {user.isSuperManager && (
                        <span style={{
                          fontSize: '10px', fontWeight: '700', color: 'var(--warning)',
                          background: 'linear-gradient(135deg, var(--border), var(--border))', padding: '2px 10px', borderRadius: '20px',
                          border: '1px solid #fcd34d', letterSpacing: '0.5px',
                        }}>
                          ⭐ SYSTEM OWNER
                        </span>
                      )}
                      {user.isTerminated && (
                        <span style={{
                          fontSize: '10px', fontWeight: '700', color: 'var(--danger)',
                          background: 'var(--danger-light)', padding: '1px 8px', borderRadius: '20px',
                        }}>
                          TERMINATED
                        </span>
                      )}
                      {user.deletionRequestedAt && (
                        <span style={{
                          fontSize: '10px', fontWeight: '700', color: 'var(--danger, #ef4444)',
                          background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '1px 8px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        }}>
                          ⚠️ DELETION REQUESTED ({new Date(user.deletionRequestedAt).toLocaleDateString()})
                        </span>
                      )}
                    </Link>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{user.email}</span>
                      {user.securityNumber && (
                        <>
                          <span style={{ color: 'var(--border)' }}>•</span>
                          <span style={{ color: 'var(--accent)', fontWeight: '600', letterSpacing: '0.05em', flexShrink: 0 }}>{user.securityNumber}</span>
                        </>
                      )}
                    </div>
                    {/* Course badges for ADMIN/STUDENT users */}
                    {(user.role === 'ADMIN' || user.role === 'STUDENT') && user.enrollments && user.enrollments.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {user.enrollments.slice(0, 3).map(e => (
                          <span key={e.courseId} style={{
                            padding: '2px 8px', borderRadius: '50px', fontSize: '10px', fontWeight: '600',
                            background: e.course.color + '18', color: e.course.color,
                            whiteSpace: 'nowrap',
                          }}>
                            {e.course.name}
                          </span>
                        ))}
                        {user.enrollments.length > 3 && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', paddingTop: '2px' }}>+{user.enrollments.length - 3}</span>
                        )}
                      </div>
                    )}
                    {user.courseBundleAssignments && user.courseBundleAssignments.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {user.courseBundleAssignments.map(bundleAssignment => (
                          <span key={bundleAssignment.bundleId} style={{
                            padding: '2px 8px', borderRadius: '50px', fontSize: '10px', fontWeight: '700',
                            background: 'var(--primary-light)', color: 'var(--accent)',
                            whiteSpace: 'nowrap',
                          }}>
                            Bundle: {bundleAssignment.bundle.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Assigned subjects for INSTRUCTOR users */}
                    {user.role === 'INSTRUCTOR' && user.instructorAssignments && user.instructorAssignments.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {user.instructorAssignments.slice(0, 3).map(a => (
                          <span key={a.courseId} style={{
                            padding: '2px 8px', borderRadius: '50px', fontSize: '10px', fontWeight: '600',
                            background: a.course.color + '18', color: a.course.color,
                            whiteSpace: 'nowrap',
                          }}>
                            {a.course.name}
                          </span>
                        ))}
                        {user.instructorAssignments.length > 3 && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', paddingTop: '2px' }}>+{user.instructorAssignments.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Right-side Columns for Alignment */}
                  <div className="admin-user-meta" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '24px',
                    flexShrink: 0,
                    marginLeft: 'auto'
                  }}>
                    {/* Google/Newbie Tag Column */}
                    <div style={{ width: '170px', display: 'flex', justifyContent: 'center', flexShrink: 0, gap: '6px', flexWrap: 'wrap' }}>
                      {user.isGoogleUser && (
                        <span style={{
                          fontSize: '10px', fontWeight: '700', color: '#4285f4',
                          background: 'linear-gradient(135deg, #e8f0fe, #d2e3fc)', padding: '3px 10px', borderRadius: '20px',
                          border: '1px solid #c6d9f1', letterSpacing: '0.5px',
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          GOOGLE
                        </span>
                      )}
                      {isNewUser && (
                        <span style={{
                          fontSize: '10px', fontWeight: '700', color: '#065f46',
                          background: 'linear-gradient(135deg, #dcfce7, var(--border))', padding: '3px 10px', borderRadius: '20px',
                          border: '1px solid #86efac', letterSpacing: '0.5px',
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                        }}>
                          NEWBIEE
                        </span>
                      )}
                    </div>

                    {/* Role Badge Column */}
                    <div style={{ width: '90px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="badge" style={{ background: rc.bg, color: rc.color, minWidth: '85px', textAlign: 'center' }}>
                        {user.role}
                      </span>
                    </div>
                    
                    {/* Date Column */}
                    <div style={{ width: '100px', flexShrink: 0, textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
                      {createdAtLabel}
                    </div>

                    {/* Actions Column */}
                    <div style={{ minWidth: '190px', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexShrink: 0, flexWrap: 'wrap' }}>
                      {user.deletionRequestedAt && userRole === 'MANAGER' && (
                        <button
                          onClick={() => handleDismissDeletionRequest(user)}
                          className="btn btn-sm"
                          style={{
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border)',
                            background: 'var(--surface-2)',
                            fontSize: '11px',
                          }}
                          title="Dismiss deletion request"
                        >
                          Dismiss Request
                        </button>
                      )}
                      <Link href={`/admin/users/${user.id}`} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit
                      </Link>
                      {!user.isSuperManager && user.role === 'STUDENT' && userRole === 'MANAGER' && (
                        <button
                          onClick={() => handleToggleTerminate(user)}
                          disabled={togglingId === user.id}
                          className="btn btn-sm"
                          style={{
                            color: user.isTerminated ? 'var(--success)' : 'var(--danger)',
                            border: user.isTerminated ? '1px solid #d1fae5' : '1px solid #fee2e2',
                            background: user.isTerminated ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
                            minWidth: '95px',
                          }}
                        >
                          {togglingId === user.id ? (
                            <svg className="spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"/></svg>
                          ) : user.isTerminated ? (
                            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Revert</>
                          ) : (
                            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Terminate</>
                          )}
                        </button>
                      )}
                      {!user.isSuperManager && userRole === 'MANAGER' && (
                        <button onClick={() => handleDelete(user.id)} className="btn btn-sm" style={{ color: 'var(--danger)', border: '1px solid #fee2e2' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>No users found</div>
            )}
          </div>
        )}
      </div>
      </>

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="modal-overlay" onClick={() => !bulkImporting && setShowBulkImport(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '560px', width: '94%', borderRadius: '20px' }}
          >
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 650, margin: 0 }}>Bulk Import Students</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Paste emails only. Existing accounts are skipped.
                </p>
              </div>
              <button
                onClick={() => !bulkImporting && setShowBulkImport(false)}
                style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {!bulkImportResult ? (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Emails</label>
                    <textarea
                      className="form-input"
                      value={bulkEmailsText}
                      onChange={e => setBulkEmailsText(e.target.value)}
                      placeholder={'one@email.com\ntwo@email.com\nthree@email.com'}
                      rows={10}
                      disabled={bulkImporting}
                      style={{ resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '13px' }}
                    />
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      One email per line (commas/spaces also work). For each new email we create a student with security ID, notification pool, and demo course if available. Name is taken from the email prefix.
                    </p>
                  </div>
                  {bulkImportError && (
                    <div style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 600 }}>{bulkImportError}</div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px',
                  }}>
                    {[
                      { label: 'Created', value: bulkImportResult.summary.created, color: 'var(--success, #10b981)' },
                      { label: 'Skipped', value: bulkImportResult.summary.skippedExisting, color: 'var(--text-muted)' },
                      { label: 'Invalid', value: bulkImportResult.summary.invalid + bulkImportResult.summary.failed, color: 'var(--danger)' },
                    ].map(stat => (
                      <div key={stat.label} style={{
                        padding: '12px',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {bulkImportResult.created.length > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        New accounts
                      </div>
                      <div style={{
                        maxHeight: '180px',
                        overflowY: 'auto',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        padding: '8px 10px',
                        fontSize: '12px',
                      }}>
                        {bulkImportResult.created.map(u => (
                          <div key={u.email} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '4px 0', borderBottom: '1px solid var(--border-light)' }}>
                            <span style={{ color: 'var(--text-primary)' }}>{u.email}</span>
                            <span style={{ color: 'var(--accent)', fontWeight: 650 }}>{u.securityNumber}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {bulkImportResult.skippedExisting.length > 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                      Skipped existing: {bulkImportResult.skippedExisting.slice(0, 8).join(', ')}
                      {bulkImportResult.skippedExisting.length > 8 ? ` +${bulkImportResult.skippedExisting.length - 8} more` : ''}
                    </p>
                  )}
                  {bulkImportResult.invalid.length > 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--danger)', margin: 0 }}>
                      Invalid: {bulkImportResult.invalid.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowBulkImport(false)}
                className="btn btn-ghost"
                disabled={bulkImporting}
              >
                {bulkImportResult ? 'Close' : 'Cancel'}
              </button>
              {!bulkImportResult && (
                <button
                  onClick={handleBulkImport}
                  disabled={bulkImporting || !bulkEmailsText.trim()}
                  className="btn btn-primary"
                >
                  {bulkImporting ? 'Importing…' : 'Import Students'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '600' }}>
                {editId ? 'Edit User' : 'Create New User'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
              {error && (
                <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
                  {error}
                </div>
              )}
              {editId && (
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input className="form-input" value={`${form.firstName} ${form.lastName}`.trim()} disabled style={{ opacity: 0.6 }} />
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input className="form-input" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} placeholder="John" />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input className="form-input" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Doe" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" className="form-input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@example.com" disabled={editingUserIsSuperManager} style={editingUserIsSuperManager ? { opacity: 0.6 } : {}} />
                {editingUserIsSuperManager && <span style={{ fontSize: '10px', color: 'var(--warning)' }}>Super Manager email cannot be changed</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input className="form-input" value={form.mobileNumber} onChange={e => setForm(p => ({ ...p, mobileNumber: e.target.value }))} placeholder="+91 9876543210" />
              </div>
              {/* Password field: only show reset option in edit mode, hidden for create (auto-generated) */}
              {editId && !editingUserIsSuperManager && (
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Password is auto-generated. Use the button to reset.</span>
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, password: p.password === 'RESET' ? '' : 'RESET' }))}
                      className="btn btn-sm"
                      style={{
                        color: form.password === 'RESET' ? 'var(--danger)' : 'var(--info)',
                        border: form.password === 'RESET' ? '1px solid #fee2e2' : '1px solid #dbeafe',
                        background: form.password === 'RESET' ? 'var(--danger-light)' : 'var(--info-light)',
                        fontSize: '11px',
                      }}
                    >
                      {form.password === 'RESET' ? '✓ Will Reset' : 'Reset Password'}
                    </button>
                  </div>
                </div>
              )}

              {editingUserIsSuperManager && (
                <div style={{ padding: '10px 14px', background: 'var(--warning-light)', borderRadius: '8px', fontSize: '12px', color: 'var(--warning)', border: '1px solid #fcd34d' }}>
                  🔒 Super Manager credentials cannot be changed here.
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Role</label>
                {editingUserIsSuperManager ? (
                  <input className="form-input" value="MANAGER (System Owner)" disabled style={{ opacity: 0.6 }} />
                ) : userRole === 'MANAGER' ? (
                  <select className="form-input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value, courseIds: [], bundleIds: [], assignedCourseIds: [] }))}>
                    <option value="STUDENT">Student</option>
                    <option value="ADMIN">Admin</option>
                    {managerCount < 2 && <option value="MANAGER">Manager</option>}
                  </select>
                ) : (
                  <input className="form-input" value="STUDENT" disabled style={{ opacity: 0.6 }} />
                )}
              </div>

              {!editId && (
                <div className="form-group">
                  <label className="form-label">Gender *</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      <input 
                        type="radio" 
                        name="gender" 
                        value="MALE" 
                        checked={form.gender === 'MALE'} 
                        onChange={() => setForm(p => ({ ...p, gender: 'MALE' }))} 
                      />
                      Male
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      <input 
                        type="radio" 
                        name="gender" 
                        value="FEMALE" 
                        checked={form.gender === 'FEMALE'} 
                        onChange={() => setForm(p => ({ ...p, gender: 'FEMALE' }))} 
                      />
                      Female
                    </label>
                  </div>
                </div>
              )}

              {editId && (
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      <input 
                        type="radio" 
                        name="gender" 
                        value="MALE" 
                        checked={form.gender === 'MALE'} 
                        onChange={() => setForm(p => ({ ...p, gender: 'MALE' }))} 
                      />
                      Male
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      <input 
                        type="radio" 
                        name="gender" 
                        value="FEMALE" 
                        checked={form.gender === 'FEMALE'} 
                        onChange={() => setForm(p => ({ ...p, gender: 'FEMALE' }))} 
                      />
                      Female
                    </label>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Managers can update gender anytime.</span>
                </div>
              )}

              {/* Notification Group Email(s) Visibility & Tag Editor */}
              <div className="form-group" style={{ background: 'var(--surface-2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: '700', fontSize: '12px', color: 'var(--text-primary)' }}>
                    📢 Assigned Notification Group Email(s)
                  </label>
                  <a href="/google-sync" style={{ fontSize: '11px', color: 'var(--primary)', textDecoration: 'none', fontWeight: '700' }}>
                    Manage Pools →
                  </a>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  {form.notificationGroupEmails.length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No notification group assigned yet. (Auto-assigns from active pool on save)
                    </span>
                  ) : (
                    form.notificationGroupEmails.map(email => (
                      <span key={email} style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        background: 'var(--primary-light, #e0e7ff)',
                        color: 'var(--primary, #4338ca)',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        border: '1px solid var(--border)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}>
                        ✉️ {email}
                      </span>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="e.g. notifications-group-1@genziitian.org"
                    id="modalNotifGroupInput"
                    style={{ flex: 1, fontSize: '12px' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const val = (e.currentTarget.value || '').trim().toLowerCase()
                        if (val && !form.notificationGroupEmails.includes(val)) {
                          setForm(p => ({ ...p, notificationGroupEmails: Array.from(new Set([...p.notificationGroupEmails, val])) }))
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
                      const input = document.getElementById('modalNotifGroupInput') as HTMLInputElement
                      const val = (input?.value || '').trim().toLowerCase()
                      if (val && !form.notificationGroupEmails.includes(val)) {
                        setForm(p => ({ ...p, notificationGroupEmails: Array.from(new Set([...p.notificationGroupEmails, val])) }))
                        input.value = ''
                      }
                    }}
                  >
                    + Add Email
                  </button>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                  Exact Google Workspace Group email address(es) this user receives notifications from.
                </span>
              </div>
              
              {/* Granular Permissions (MANAGER ONLY for ADMIN/INSTRUCTOR roles) */}
              {userRole === 'MANAGER' && (form.role === 'ADMIN' || form.role === 'INSTRUCTOR') && (
                <div style={{
                  background: 'var(--surface)', padding: '12px', borderRadius: '10px',
                  border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '2px' }}>GRANULAR PERMISSIONS</div>
                  
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Allow User Termination</span>
                    <div style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
                      <input 
                        type="checkbox" 
                        style={{ opacity: 0, width: 0, height: 0 }} 
                        checked={form.canTerminate}
                        onChange={e => setForm(p => ({ ...p, canTerminate: e.target.checked }))}
                      />
                      <span style={{
                        position: 'absolute', cursor: 'pointer', inset: 0,
                        backgroundColor: form.canTerminate ? 'var(--info)' : 'var(--border)',
                        borderRadius: '34px', transition: '.2s'
                      }}>
                        <span style={{
                          position: 'absolute', content: '""', height: '14px', width: '14px',
                          left: form.canTerminate ? '18px' : '3px', bottom: '3px',
                          backgroundColor: 'var(--surface)', borderRadius: '50%', transition: '.2s'
                        }} />
                      </span>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Allow Student Creation</span>
                    <div style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
                      <input 
                        type="checkbox" 
                        style={{ opacity: 0, width: 0, height: 0 }} 
                        checked={form.canCreateStudents}
                        onChange={e => setForm(p => ({ ...p, canCreateStudents: e.target.checked }))}
                      />
                      <span style={{
                        position: 'absolute', cursor: 'pointer', inset: 0,
                        backgroundColor: form.canCreateStudents ? 'var(--info)' : 'var(--border)',
                        borderRadius: '34px', transition: '.2s'
                      }}>
                        <span style={{
                          position: 'absolute', content: '""', height: '14px', width: '14px',
                          left: form.canCreateStudents ? '18px' : '3px', bottom: '3px',
                          backgroundColor: 'var(--surface)', borderRadius: '50%', transition: '.2s'
                        }} />
                      </span>
                    </div>
                  </label>
                </div>
              )}
              {/* Course assignment for ADMIN or STUDENT roles */}
              {(form.role === 'ADMIN' || form.role === 'STUDENT') && (
                <div className="form-group">
                  {bundles.length > 0 && (
                    <>
                      <label className="form-label">Assigned Bundles</label>
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: '6px',
                        maxHeight: '160px', overflowY: 'auto',
                        padding: '10px', borderRadius: '8px',
                        background: '#f3f0ff', border: '1px solid #ddd6fe',
                        marginBottom: '12px',
                      }}>
                        {bundles.map((bundle: CourseBundleInfo) => (
                          <label key={bundle.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={form.bundleIds.includes(bundle.id)}
                              onChange={e => {
                                setForm(p => ({
                                  ...p,
                                  bundleIds: e.target.checked
                                    ? [...p.bundleIds, bundle.id]
                                    : p.bundleIds.filter(id => id !== bundle.id)
                                }))
                              }}
                            />
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#5b21b6' }}>{bundle.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--accent)' }}>
                              ({bundle.courses?.length || 0} courses)
                            </span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                  <label className="form-label">Assigned Subject Courses</label>
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '6px',
                    maxHeight: '200px', overflowY: 'auto',
                    padding: '10px', borderRadius: '8px',
                    background: 'var(--bg)', border: '1px solid var(--border)',
                  }}>
                    {courses.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No courses available</span>
                    ) : (
                      courses.map(cls => (
                        <label key={cls.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={form.courseIds.includes(cls.id)}
                            disabled={bundledCourseIds.has(cls.id) || !!cls.isEffectivelyDisabled}
                            onChange={e => {
                              setForm(p => ({
                                ...p,
                                courseIds: e.target.checked
                                  ? [...p.courseIds, cls.id]
                                  : p.courseIds.filter(id => id !== cls.id)
                              }))
                            }}
                          />
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: cls.color, flexShrink: 0,
                          }} />
                          <span style={{ fontSize: '13px' }}>{cls.name}</span>
                          {cls.subject && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({cls.subject})</span>
                          )}
                          {cls.isExpired && (
                            <span style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: '700' }}>Expired</span>
                          )}
                          {cls.isEffectivelyDisabled && !cls.isExpired && (
                            <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '700' }}>Disabled</span>
                          )}
                          {bundledCourseIds.has(cls.id) && (
                            <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '600' }}>Included by selected bundle</span>
                          )}
                          {form.courseIds.includes(cls.id) && !bundledCourseIds.has(cls.id) && (
                            <select
                              value={form.enrollmentTypes[cls.id] || 'LIVE'}
                              onChange={(e) => {
                                const newTypes = { ...form.enrollmentTypes, [cls.id]: e.target.value }
                                setForm(p => ({ ...p, enrollmentTypes: newTypes }))
                              }}
                              style={{
                                marginLeft: 'auto', padding: '2px 8px', borderRadius: '4px',
                                border: '1px solid var(--border)', fontSize: '11px', background: 'var(--surface)',
                                fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer'
                              }}
                              onClick={e => e.stopPropagation()}
                            >
                              <option value="LIVE">Live</option>
                              <option value="RECORDED">Recording</option>
                            </select>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
              {/* Subject assignment for INSTRUCTOR role */}
              {form.role === 'INSTRUCTOR' && userRole === 'MANAGER' && (
                <div className="form-group">
                  <label className="form-label">Assigned Subjects / Courses</label>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Select the subjects this instructor can manage content for.
                  </p>
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '6px',
                    maxHeight: '200px', overflowY: 'auto',
                    padding: '10px', borderRadius: '8px',
                    background: 'var(--bg)', border: '1px solid var(--border)',
                  }}>
                    {courses.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No courses available</span>
                    ) : (
                      courses.map(cls => (
                        <label key={cls.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={form.assignedCourseIds.includes(cls.id)}
                            disabled={!!cls.isEffectivelyDisabled}
                            onChange={e => {
                              setForm(p => ({
                                ...p,
                                assignedCourseIds: e.target.checked
                                  ? [...p.assignedCourseIds, cls.id]
                                  : p.assignedCourseIds.filter(id => id !== cls.id)
                              }))
                            }}
                          />
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: cls.color, flexShrink: 0,
                          }} />
                          <span style={{ fontSize: '13px' }}>{cls.name}</span>
                          {cls.subject && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({cls.subject})</span>
                          )}
                          {cls.isExpired && (
                            <span style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: '700' }}>Expired</span>
                          )}
                          {cls.isEffectivelyDisabled && !cls.isExpired && (
                            <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '700' }}>Disabled</span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : (editId ? 'Update User' : 'Create User')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '600' }}>🔑 Generated Password</h3>
              <button onClick={() => setShowPasswordModal(false)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '14px', background: 'var(--warning-light)', borderRadius: '10px', fontSize: '12px', color: 'var(--warning)', border: '1px solid #fcd34d' }}>
                ⚠️ This password will only be shown <strong>once</strong>. Copy and store it securely. You can reveal it up to 2 more times, after which a reset will be required.
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '14px 18px', borderRadius: '10px',
                background: 'var(--success-light)', border: '1px solid var(--border)',
                fontFamily: 'monospace', fontSize: '15px', fontWeight: '600', color: 'var(--success)',
                letterSpacing: '1px',
              }}>
                <span style={{ flex: 1, wordBreak: 'break-all' }}>{generatedPassword}</span>
                <button
                  onClick={copyPassword}
                  className="btn btn-sm"
                  style={{
                    color: passwordCopied ? 'var(--success)' : 'var(--info)',
                    border: passwordCopied ? '1px solid #d1fae5' : '1px solid #dbeafe',
                    background: passwordCopied ? 'var(--success-light)' : 'var(--info-light)',
                    flexShrink: 0,
                  }}
                >
                  {passwordCopied ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowPasswordModal(false)} className="btn btn-primary" style={{ borderRadius: '50px' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedUserId && (
        <ManagerUserModal 
          userId={selectedUserId} 
          onClose={() => setSelectedUserId(null)} 
          onUpdate={loadUsers} 
        />
      )}
    </div>
  )
}
