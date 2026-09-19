'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import UserAvatar from '@/components/UserAvatar'

export default function ManageContactsPage() {
  const [search, setSearch] = useState('')
  const [studentFilter, setStudentFilter] = useState('')
  const [page, setPage] = useState(1)
  const limit = 50

  const [contactToDelete, setContactToDelete] = useState<any>(null)
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string; email: string; contactCount?: number } | null>(null)
  const [alsoDeleteUserAccount, setAlsoDeleteUserAccount] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const fetcher = (url: string) => fetch(url).then(r => r.json())
  const { data: authData } = useSWR('/api/auth/me', fetcher)
  const isManager = authData?.user?.role === 'MANAGER'
  const canUseMailAssigner = authData?.user?.role === 'MANAGER' || authData?.user?.role === 'ADMIN'

  const apiUrl = `/api/admin/contacts?search=${encodeURIComponent(search)}&studentId=${encodeURIComponent(studentFilter)}&page=${page}&limit=${limit}`
  const { data, error, isLoading, mutate } = useSWR(apiUrl, fetcher)

  const contacts = data?.contacts || []
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 }
  const stats = data?.stats || { totalContacts: 0, totalStudentsWithContacts: 0, uniquePhoneNumbers: 0 }
  const studentsList: Array<{ id: string; name: string; email: string; avatar: string | null; contactCount: number }> = data?.studentsList || []

  const handleExport = () => {
    const exportUrl = `/api/admin/contacts?search=${encodeURIComponent(search)}&studentId=${encodeURIComponent(studentFilter)}&export=csv`
    window.open(exportUrl, '_blank')
  }

  const formatPhoneNumber = (phone?: string) => {
    if (!phone) return '—'
    if (phone.startsWith('NO_NUM_')) return 'No Number Provided'
    return phone
  }

  const getWhatsAppLink = (phone?: string) => {
    if (!phone || phone.startsWith('NO_NUM_')) return null
    const cleanDigits = phone.replace(/[^\d]/g, '')
    if (!cleanDigits) return null
    return `https://wa.me/${cleanDigits}`
  }

  const handleDeleteSingleContact = async (contact: any) => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/contacts?contactId=${encodeURIComponent(contact.id)}`, {
        method: 'DELETE',
      })
      const result = await res.json()
      if (res.ok) {
        setStatusMessage({
          text: `Contact "${contact.name || contact.phoneNumber || 'Contact'}" was successfully deleted.`,
          type: 'success',
        })
        setContactToDelete(null)
        mutate()
      } else {
        alert(result.error || 'Failed to delete contact')
      }
    } catch {
      alert('Network error while deleting contact')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteUserData = async (
    student: { id: string; name: string; email: string; contactCount?: number },
    deleteAccount = false
  ) => {
    setIsDeleting(true)
    try {
      const res = await fetch(
        `/api/admin/contacts?studentId=${encodeURIComponent(student.id)}&deleteUserAccount=${deleteAccount}`,
        {
          method: 'DELETE',
        }
      )
      const result = await res.json()
      if (res.ok) {
        if (deleteAccount) {
          setStatusMessage({
            text: `User account "${student.name}" and all synced contacts were permanently removed.`,
            type: 'success',
          })
          if (studentFilter === student.id) {
            setStudentFilter('')
          }
        } else {
          setStatusMessage({
            text: `Successfully removed all ${result.count ?? ''} synced contacts for student "${student.name}".`,
            type: 'success',
          })
        }
        setUserToDelete(null)
        setAlsoDeleteUserAccount(false)
        mutate()
      } else {
        alert(result.error || 'Failed to delete user data')
      }
    } catch {
      alert('Network error while deleting user data')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* ── Top Header ────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link
              href="/manage"
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--primary)',
                textDecoration: 'none',
              }}
            >
              ← Back to Management
            </Link>
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '800',
            color: 'var(--text-primary)',
            marginTop: '6px',
            marginBottom: '4px',
            letterSpacing: '-0.02em',
          }}>
            👥 Student Synced Contacts
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
            Contacts synced from students&apos; mobile devices via Flutter and Capacitor apps.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {canUseMailAssigner && (
            <Link
              href="/manage/mail-assigner"
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 15px',
                borderRadius: '999px',
                fontWeight: '700',
                fontSize: '13.5px',
                background: 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(37,99,235,0.22))',
                border: '1px solid rgba(56,189,248,0.45)',
                color: '#7DD3FC',
                textDecoration: 'none',
              }}
              title="Assign serial numbers and notification Google Group pool emails (not course mails)"
            >
              ✉ Mail Assigner
            </Link>
          )}

          <button
            onClick={() => mutate()}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 15px',
              borderRadius: '12px',
              fontWeight: '600',
              fontSize: '13.5px',
            }}
          >
            🔄 Refresh
          </button>

          <button
            onClick={handleExport}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '13.5px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            }}
          >
            📥 Export to CSV / Excel
          </button>
        </div>
      </div>

      {/* ── Metric Stat Cards ─────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div className="card" style={{ padding: '18px 20px', borderRadius: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Contacts Synced
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--primary)', marginTop: '4px' }}>
            {stats.totalContacts.toLocaleString()}
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', borderRadius: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Students Who Synced
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#10B981', marginTop: '4px' }}>
            {stats.totalStudentsWithContacts.toLocaleString()}
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', borderRadius: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Unique Phone Numbers
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#8B5CF6', marginTop: '4px' }}>
            {stats.uniquePhoneNumbers.toLocaleString()}
          </div>
        </div>
      </div>

      {/* ── Status Toast / Banner ─────────────────────────────── */}
      {statusMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderRadius: '14px',
          marginBottom: '20px',
          background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          color: statusMessage.type === 'success' ? '#10B981' : '#EF4444',
          fontSize: '13.5px',
          fontWeight: '600',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{statusMessage.type === 'success' ? '✅' : '❌'}</span>
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '14px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Search & Filter Bar ───────────────────────────────── */}
      <div className="card" style={{ padding: '14px 18px', borderRadius: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '260px' }}>
            <span style={{ fontSize: '18px' }}>🔍</span>
            <input
              type="text"
              placeholder="Search by Contact Name, Phone Number, or Student Name / Email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '14px',
                color: 'var(--text-primary)',
              }}
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('')
                  setPage(1)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontWeight: '700',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Student Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-muted)' }}>Student:</span>
            <select
              value={studentFilter}
              onChange={(e) => {
                setStudentFilter(e.target.value)
                setPage(1)
              }}
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '7px 12px',
                fontSize: '13px',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '240px',
              }}
            >
              <option value="">All Students ({stats.totalStudentsWithContacts})</option>
              {studentsList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.contactCount} contacts)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Filtered by Student Banner ────────────────────────── */}
      {studentFilter && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 18px',
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '14px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}>
            <span>👤</span>
            <span style={{ color: 'var(--text-muted)' }}>Filtered by student:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {studentsList.find(s => s.id === studentFilter)?.name || 'Selected Student'}
            </strong>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              ({pagination.total} contacts)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => {
                const s = studentsList.find(item => item.id === studentFilter)
                setUserToDelete({
                  id: studentFilter,
                  name: s?.name || 'Selected Student',
                  email: s?.email || '',
                  contactCount: pagination.total,
                })
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: '700',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#EF4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              🗑️ Delete All Contacts For This Student
            </button>

            <button
              onClick={() => {
                setStudentFilter('')
                setPage(1)
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '12.5px',
                fontWeight: '600',
                textDecoration: 'underline',
              }}
            >
              Clear filter
            </button>
          </div>
        </div>
      )}

      {/* ── Contacts Table ────────────────────────────────────── */}
      <div className="card" style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Contact Name
                </th>
                <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Phone Number
                </th>
                <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Synced By Student
                </th>
                <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Source
                </th>
                <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Sync Date
                </th>
                <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading synced contacts...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '50px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📱</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      No Synced Contacts Found
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {search || studentFilter ? 'Try adjusting your search or student filter.' : 'Contacts synced from students’ mobile devices will automatically show up here.'}
                    </div>
                  </td>
                </tr>
              ) : (
                contacts.map((c: any) => {
                  const waLink = getWhatsAppLink(c.phoneNumber)
                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Name */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                          {c.name || 'Unnamed'}
                        </div>
                        {c.email && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {c.email}
                          </div>
                        )}
                      </td>

                      {/* Phone */}
                      <td style={{ padding: '14px 18px', fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {formatPhoneNumber(c.phoneNumber)}
                      </td>

                      {/* Synced by Student */}
                      <td style={{ padding: '14px 18px' }}>
                        {c.student ? (
                          <div
                            onClick={() => {
                              setStudentFilter(c.student.id)
                              setPage(1)
                            }}
                            title={`Filter contacts by ${c.student.name}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: 'pointer',
                              padding: '4px 6px',
                              borderRadius: '8px',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            <UserAvatar
                              user={c.student}
                              size={32}
                            />
                            <div>
                              <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {c.student.name}
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                {c.student.email}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Unknown</span>
                        )}
                      </td>

                      {/* Source */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          background: c.source === 'FLUTTER_APP' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: c.source === 'FLUTTER_APP' ? 'var(--primary)' : '#10B981',
                        }}>
                          {c.source === 'FLUTTER_APP' ? 'Flutter App' : 'Capacitor App'}
                        </span>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '14px 18px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {new Date(c.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Chat on WhatsApp"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '700',
                                background: '#25D366',
                                color: '#ffffff',
                                textDecoration: 'none',
                                boxShadow: '0 2px 6px rgba(37, 211, 102, 0.3)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              💬 WhatsApp
                            </a>
                          )}

                          {/* Remove Single Contact Button */}
                          <button
                            onClick={() => setContactToDelete(c)}
                            title="Remove this contact"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '700',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              color: '#EF4444',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            🗑️ Delete
                          </button>

                          {/* Remove Whole User Data Button */}
                          {c.student && (
                            <button
                              onClick={() => {
                                const stMatch = studentsList.find(s => s.id === c.student.id)
                                setUserToDelete({
                                  id: c.student.id,
                                  name: c.student.name,
                                  email: c.student.email,
                                  contactCount: stMatch?.contactCount,
                                })
                              }}
                              title={`Remove all data for student ${c.student.name}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '700',
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                color: '#F59E0B',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              👥 Clear User
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Footer ─────────────────────────────────── */}
        {pagination.totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            background: 'var(--surface-2)',
            borderTop: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Showing {((pagination.page - 1) * limit) + 1} to {Math.min(pagination.page * limit, pagination.total)} of {pagination.total} contacts
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12.5px', borderRadius: '8px' }}
              >
                Previous
              </button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '13px', fontWeight: '700' }}>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12.5px', borderRadius: '8px' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: Delete Single Contact ──────────────────────── */}
      {contactToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => !isDeleting && setContactToDelete(null)}
        >
          <div
            className="modal"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              borderRadius: '20px',
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
              }}>
                🗑️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Delete Single Contact
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  This will remove this contact record permanently.
                </p>
              </div>
            </div>

            <div style={{
              background: 'var(--surface-2)',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '20px',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {contactToDelete.name || 'Unnamed Contact'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                📞 {formatPhoneNumber(contactToDelete.phoneNumber)}
              </div>
              {contactToDelete.email && (
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  ✉️ {contactToDelete.email}
                </div>
              )}
              {contactToDelete.student && (
                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px dashed var(--border-color)',
                }}>
                  Synced by: <strong>{contactToDelete.student.name}</strong> ({contactToDelete.student.email})
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setContactToDelete(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13.5px', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteSingleContact(contactToDelete)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  background: '#EF4444',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Delete Whole User Data ─────────────────────── */}
      {userToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => !isDeleting && setUserToDelete(null)}
        >
          <div
            className="modal"
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '24px',
              borderRadius: '20px',
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
              }}>
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Remove Whole User Data
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Delete all synced contacts uploaded by this student
                </p>
              </div>
            </div>

            <div style={{
              background: 'var(--surface-2)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '16px',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {userToDelete.name}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {userToDelete.email}
                  </div>
                </div>
                {typeof userToDelete.contactCount === 'number' && (
                  <div style={{
                    background: 'rgba(99, 102, 241, 0.12)',
                    color: 'var(--primary)',
                    padding: '6px 12px',
                    borderRadius: '10px',
                    fontWeight: '800',
                    fontSize: '13px',
                    textAlign: 'center',
                  }}>
                    {userToDelete.contactCount} Contacts
                  </div>
                )}
              </div>
            </div>

            <p style={{ fontSize: '13.5px', lineHeight: '1.5', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Are you sure you want to remove <strong>all synced contacts</strong> belonging to this user? This will delete all mobile contacts uploaded from their devices.
            </p>

            {isManager && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px dashed rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '20px',
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={alsoDeleteUserAccount}
                    onChange={(e) => setAlsoDeleteUserAccount(e.target.checked)}
                    style={{ marginTop: '3px', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#EF4444' }}>
                      Also delete user account entirely (Manager Action)
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Check this only if you want to completely erase the student's profile, enrollments, and login account from the platform.
                    </div>
                  </div>
                </label>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setUserToDelete(null)
                  setAlsoDeleteUserAccount(false)
                }}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13.5px', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteUserData(userToDelete, alsoDeleteUserAccount)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  background: alsoDeleteUserAccount ? '#DC2626' : '#EF4444',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                {isDeleting
                  ? 'Processing...'
                  : alsoDeleteUserAccount
                  ? 'Delete User & All Contacts'
                  : 'Delete All User Contacts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
