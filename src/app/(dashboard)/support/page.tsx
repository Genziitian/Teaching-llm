'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { formatIST } from '@/lib/date-utils'
import ManagerUserModal from '@/components/ManagerUserModal'
import UserAvatar from '@/components/UserAvatar'
import StaffRoleBadge from '@/components/StaffRoleBadge'

interface Ticket {
  id: string
  title: string
  description: string
  type: string
  status: string
  priority: string
  classId?: string
  class?: { id: string; name: string; color: string }
  user: { id: string; name: string; role: string }
  assignedTo?: { id: string; name: string; role: string } | null
  replies: Reply[]
  createdAt: string
  updatedAt: string
}
interface Reply {
  id: string
  content: string
  imageUrl?: string | null
  createdAt: string
  sender: { id: string; name: string; role: string }
}
interface ChatMsg {
  id: string
  content: string
  imageUrl?: string | null
  createdAt: string
  sender: { id: string; name: string; role: string }
}
interface ChatSession {
  id: string
  status: string
  expiresAt?: string
  student: { id: string; name: string }
  agent?: { id: string; name: string; role: string }
  _count?: { messages: number }
  messages?: ChatMsg[]
}
interface UserReport {
  id: string
  reason: string
  subReason?: string | null
  details?: string | null
  status: string
  createdAt: string
  updatedAt: string
  reviewNote?: string | null
  reportedUser: { id: string; name: string; role: string; avatar?: string | null; gender?: string | null }
  reporter?: { id: string; name: string; role: string; avatar?: string | null; gender?: string | null }
  reviewedBy?: { id: string; name: string; role: string } | null
}
interface ClassItem { id: string; name: string; color: string }
interface Faq { id: string; question: string; answer: string; order: number }
interface AdminUser { id: string; name: string; role: string }
interface FeatureReq {
  id: string
  title: string
  description: string
  imageUrls: string[]
  status: string
  createdAt: string
  updatedAt: string
  user: { id: string; name: string; role: string; email: string; securityNumber?: string; avatar?: string }
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'var(--info)', IN_PROGRESS: 'var(--warning)', RESOLVED: 'var(--success)', CLOSED: 'var(--text-muted)',
}
const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'var(--success)', MEDIUM: 'var(--warning)', HIGH: 'var(--danger)',
}

function pill(bg: string) {
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '3px 11px', borderRadius: '50px',
    background: bg + '18', color: bg,
    fontSize: '11px', fontWeight: '700', letterSpacing: '0.4px',
    border: `1px solid ${bg}33`,
  } as React.CSSProperties
}

function getRelativeTime(dateStr: string, status: string): string {
  const verb = status === 'RESOLVED' ? 'Resolved' : status === 'CLOSED' ? 'Closed' : status === 'IN_PROGRESS' ? 'Updated' : 'Opened'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000)
  if (mins < 2) return `${verb} just now`
  if (hours < 1) return `${verb} ${mins}m ago`
  if (hours < 24) return `${verb} ${hours}h ago`
  if (days === 1) return `${verb} yesterday`
  if (days < 7) return `${verb} ${days} days ago`
  return `${verb} ${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''} ago`
}

function shortId(id: string): string {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return String(8000 + (hash % 2000))
}

function formatMessageDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TicketStatusIcon({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || 'var(--text-muted)'
  return (
    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: c + '15', border: `1.5px solid ${c}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {status === 'RESOLVED' && <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>}
      {status === 'IN_PROGRESS' && <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
      {status === 'OPEN' && <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
      {status === 'CLOSED' && <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  const neu = { background: 'var(--surface-2)', boxShadow: '6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)' }
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '14px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '50px', ...neu }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
      Back
    </button>
  )
}

// ── Refactored Modals Moved Outside to prevent focus loss during typing ────

function CreateTicketModal({ 
  onClose, form, setForm, classes, userRole, submitTicket, hasReachedActiveLimit, ticketError, submittingTicket
}: { 
  onClose: () => void, form: any, setForm: (f: any) => void, classes: ClassItem[], userRole: string, submitTicket: () => void,
  hasReachedActiveLimit?: boolean, ticketError?: string | null, submittingTicket?: boolean
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '16px', fontWeight: '800' }}>Raise a Support Ticket</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {hasReachedActiveLimit && (
            <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', fontSize: '12.5px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>You already have 3 active tickets. You cannot submit a new ticket until a manager resolves or closes an existing ticket.</span>
            </div>
          )}
          {ticketError && (
            <div style={{ padding: '10px 14px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', fontSize: '12px', fontWeight: '600' }}>
              {ticketError}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Issue Type</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['GENERAL', 'SUBJECT'].map(t => (
                <button key={t} onClick={() => setForm((f: any) => ({ ...f, type: t }))} style={{ flex: 1, padding: '10px', borderRadius: '14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: '700', background: form.type === t ? 'var(--primary)' : 'var(--surface-2)', color: form.type === t ? '#fff' : 'var(--text-secondary)', boxShadow: form.type === t ? '4px 4px 10px rgba(54,54,232,0.3)' : '4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light)' }}>
                  {t === 'GENERAL' ? '📋 General Support' : '📚 Subject Related'}
                </button>
              ))}
            </div>
          </div>
          {form.type === 'SUBJECT' && (
            <div className="form-group">
              <label className="form-label">Select Subject</label>
              <select className="form-input" value={form.classId} onChange={e => setForm((f: any) => ({ ...f, classId: e.target.value }))}>
                <option value="">Choose a subject...</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {userRole === 'MANAGER' && (
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="Brief description of the issue" />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea className="form-input" rows={4} value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="Explain your issue in detail..." style={{ resize: 'vertical' }} />
          </div>
          {userRole === 'MANAGER' && (
            <div className="form-group">
              <label className="form-label">Priority</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['LOW', 'MEDIUM', 'HIGH'].map(p => (
                  <button key={p} onClick={() => setForm((f: any) => ({ ...f, priority: p }))} style={{ flex: 1, padding: '8px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', background: form.priority === p ? PRIORITY_COLORS[p] : 'var(--surface-2)', color: form.priority === p ? '#fff' : 'var(--text-secondary)', boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)' }}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button 
            onClick={submitTicket} 
            disabled={hasReachedActiveLimit || submittingTicket} 
            className="btn btn-primary"
            style={(hasReachedActiveLimit || submittingTicket) ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
          >
            {submittingTicket ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StartChatModal({ 
  onClose, value, onChange, onSubmit 
}: { 
  onClose: () => void, value: string, onChange: (val: string) => void, onSubmit: (val: string) => void 
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '16px', fontWeight: '800' }}>Start Live Support Chat</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            To help us assist you better, please describe your issue in detail before starting the chat.
          </p>
          <div className="form-group">
            <label className="form-label">Issue Description *</label>
            <textarea 
              className="form-input" 
              rows={4} 
              value={value} 
              onChange={e => onChange(e.target.value)} 
              placeholder="Explain your issue in detail..." 
              style={{ resize: 'vertical' }} 
            />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button 
            onClick={() => onSubmit(value)} 
            className="btn btn-primary" 
            disabled={!value.trim()}
            style={{ opacity: !value.trim() ? 0.6 : 1 }}
          >
            Start Chat
          </button>
        </div>
      </div>
    </div>
  )
}

function FaqFormModal({ 
  onClose, faqForm, setFaqForm, editingFaq, saveFaq 
}: { 
  onClose: () => void, faqForm: any, setFaqForm: (f: any) => void, editingFaq: Faq | null, saveFaq: () => void 
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '16px', fontWeight: '800' }}>{editingFaq ? 'Edit FAQ' : 'Add FAQ Item'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Question *</label>
            <input className="form-input" value={faqForm.question} onChange={e => setFaqForm((f: any) => ({ ...f, question: e.target.value }))} placeholder="Enter the frequently asked question..." />
          </div>
          <div className="form-group">
            <label className="form-label">Answer *</label>
            <textarea className="form-input" rows={4} value={faqForm.answer} onChange={e => setFaqForm((f: any) => ({ ...f, answer: e.target.value }))} placeholder="Provide a clear answer..." style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={saveFaq} className="btn btn-primary">{editingFaq ? 'Save Changes' : 'Add FAQ'}</button>
        </div>
      </div>
    </div>
  )
}

export default function SupportPage() {
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [view, setView] = useState<'home' | 'allTickets' | 'chat' | 'chatHistory' | 'featureRequests' | 'userReports'>('home')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [userReports, setUserReports] = useState<UserReport[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [replyText, setReplyText] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', type: 'GENERAL', classId: '', priority: 'MEDIUM' })
  const [userRole, setUserRole] = useState('STUDENT')
  const [userId, setUserId] = useState('')
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null)
  const [editReplyText, setEditReplyText] = useState('')
  const [savingReply, setSavingReply] = useState(false)
  const [ticketError, setTicketError] = useState<string | null>(null)
  const [submittingTicket, setSubmittingTicket] = useState(false)

  const activeTicketsCount = tickets.filter(t => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length
  const hasReachedActiveLimit = userRole === 'STUDENT' && activeTicketsCount >= 3

  // FAQ
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)
  const [showFaqForm, setShowFaqForm] = useState(false)
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null)
  const [faqForm, setFaqForm] = useState({ question: '', answer: '' })

  // Ticket assignment
  const [admins, setAdmins] = useState<AdminUser[]>([])

  // Live Chat
  const [allChats, setAllChats] = useState<ChatSession[]>([])
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const repliesEndRef = useRef<HTMLDivElement>(null)

  // Chat History (manager only)
  const [historyChats, setHistoryChats] = useState<ChatSession[]>([])
  const [selectedHistory, setSelectedHistory] = useState<ChatSession | null>(null)
  const [historyMsgs, setHistoryMsgs] = useState<ChatMsg[]>([])
  const [showChatStart, setShowChatStart] = useState(false)
  const [chatInitText, setChatInitText] = useState('')
  const [selectedUserDetailsId, setSelectedUserDetailsId] = useState<string | null>(null)
  const [showManagerChatStart, setShowManagerChatStart] = useState(false)

  // Feature Requests
  const [featureRequests, setFeatureRequests] = useState<FeatureReq[]>([])
  const [showFeatureModal, setShowFeatureModal] = useState(false)
  const [featureForm, setFeatureForm] = useState({ title: '', description: '' })
  const [featureImages, setFeatureImages] = useState<File[]>([])
  const [featureImagePreviews, setFeatureImagePreviews] = useState<string[]>([])
  const [submittingFeature, setSubmittingFeature] = useState(false)
  const featureImageRef = useRef<HTMLInputElement>(null)
  // Image upload state
  const [pendingChatImage, setPendingChatImage] = useState<File | null>(null)
  const [pendingChatImagePreview, setPendingChatImagePreview] = useState<string | null>(null)
  const [pendingReplyImage, setPendingReplyImage] = useState<File | null>(null)
  const [pendingReplyImagePreview, setPendingReplyImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const chatImageRef = useRef<HTMLInputElement>(null)
  const replyImageRef = useRef<HTMLInputElement>(null)

  const neu = { background: 'var(--surface-2)', boxShadow: '6px 6px 12px var(--neu-dark), -6px -6px 12px var(--neu-light)' }
  const neuInset = { background: 'var(--surface-2)', boxShadow: 'inset 4px 4px 8px var(--neu-dark), inset -4px -4px 8px var(--neu-light)' }
  const card = { background: 'var(--surface)', borderRadius: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 6px 24px rgba(0,0,0,0.04)' }

  const loadTickets = useCallback(async () => {
    const [tr, cr, rr] = await Promise.all([
      fetch('/api/support/tickets').then(r => r.json()),
      fetch('/api/classes').then(r => r.json()),
      fetch('/api/support/user-reports').then(r => r.json()).catch(() => []),
    ])
    const sorted = Array.isArray(tr) ? [...tr].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) : []
    setTickets(sorted)
    setUserReports(Array.isArray(rr) ? rr : [])
    setClasses((cr.classes || cr || []).map((c: ClassItem) => ({ id: c.id, name: c.name, color: c.color })))
    // Also load feature requests
    fetch('/api/support/feature-requests').then(r => r.json()).then(fr => setFeatureRequests(Array.isArray(fr) ? fr : [])).catch(() => {})
  }, [])

  const loadFaqs = useCallback(async () => {
    try {
      const res = await fetch('/api/support/faq')
      const data = await res.json()
      if (Array.isArray(data)) {
        setFaqs(data)
      }
    } catch (err) {
      console.error('Failed to load FAQs:', err)
    }
  }, [])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      const role = d.user?.role || 'STUDENT'
      if (role === 'ADMIN') {
        router.replace('/dashboard')
        return
      }
      setUserRole(role)
      setUserId(d.user?.id || '')
      if (role === 'MANAGER') {
        fetch('/api/users/staff').then(r => r.json()).then((d: any) => {
          const staffList = d.staff || []
          setAdmins(staffList.filter((u: any) => u.role === 'MANAGER'))
        })
      }
    })
    loadTickets()
    loadFaqs()
  }, [loadTickets, loadFaqs, router])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('openTicket') === 'true') {
        const type = params.get('type') || 'GENERAL'
        const classId = params.get('classId') || ''
        setForm(f => ({ ...f, type, classId }))
        setShowCreate(true)
        // Clear search query from URL to prevent reopening on refresh
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }
    }
  }, [])

  // Poll tickets so replies immediately move tickets to the top and refresh statuses
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/support/tickets')
        if (res.ok) {
          const fresh = await res.json()
          if (Array.isArray(fresh)) {
            const sorted = [...fresh].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            setTickets(sorted)
            setSelected(prev => {
              if (!prev) return null
              return sorted.find(t => t.id === prev.id) || prev
            })
          }
        }
      } catch (_) {}
    }
    const timer = setInterval(poll, 5000)
    return () => clearInterval(timer)
  }, [])

  // Poll chat messages
  useEffect(() => {
    if (!activeChatId) return
    const poll = () => fetch(`/api/support/live-chats/${activeChatId}/messages`)
      .then(r => r.json()).then(d => setChatMsgs(Array.isArray(d) ? d : []))
    poll()
    const t = setInterval(poll, 3000)
    return () => clearInterval(t)
  }, [activeChatId])

  // Poll chat list when in chat view
  useEffect(() => {
    if (view !== 'chat') return
    const poll = () => fetch('/api/support/live-chats').then(r => r.json()).then(d => setAllChats(Array.isArray(d) ? d : []))
    poll()
    const t = setInterval(poll, 4000)
    return () => clearInterval(t)
  }, [view])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMsgs])
  useEffect(() => { repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [selected?.replies])

  // ── ticket actions ──────────────────────────────────────────────────────
  async function submitTicket() {
    if ((userRole === 'MANAGER' && !form.title.trim()) || !form.description.trim()) return
    if (hasReachedActiveLimit) {
      setTicketError('You have reached the maximum of 3 active tickets. Please wait until an existing ticket is resolved or closed.')
      return
    }
    setSubmittingTicket(true)
    setTicketError(null)
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTicketError(data.error || 'Failed to create ticket')
        return
      }
      setShowCreate(false)
      setForm({ title: '', description: '', type: 'GENERAL', classId: '', priority: 'MEDIUM' })
      loadTickets()
    } catch (err) {
      setTicketError('Failed to create ticket. Please try again.')
    } finally {
      setSubmittingTicket(false)
    }
  }

  async function sendReply() {
    if ((!replyText.trim() && !pendingReplyImage) || !selected) return
    setUploadingImage(true)
    try {
      let imageUrl: string | null = null
      if (pendingReplyImage) imageUrl = await uploadImage(pendingReplyImage)
      await fetch(`/api/support/tickets/${selected.id}/replies`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: replyText, imageUrl }) })
      setReplyText('')
      clearReplyImage()
      const fresh = await fetch('/api/support/tickets').then(r => r.json())
      const sorted = Array.isArray(fresh) ? [...fresh].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) : []
      setTickets(sorted)
      setSelected(sorted.find((t: Ticket) => t.id === selected.id) || null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send reply')
    }
    setUploadingImage(false)
  }

  async function updateStatus(ticketId: string, status: string) {
    await fetch(`/api/support/tickets/${ticketId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    loadTickets()
    if (selected?.id === ticketId) setSelected(prev => prev ? { ...prev, status } : null)
  }

  function formatReportReason(reason: string) {
    return reason
      .toLowerCase()
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' / ')
  }

  async function updateReportStatus(reportId: string, status: string) {
    const res = await fetch(`/api/support/user-reports/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Failed to update report')
      return
    }
    const fresh = await fetch('/api/support/user-reports').then(r => r.json()).catch(() => [])
    setUserReports(Array.isArray(fresh) ? fresh : [])
  }

  async function assignTicket(ticketId: string, assignedToId: string) {
    const fresh = await fetch(`/api/support/tickets/${ticketId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignedToId: assignedToId || null }) }).then(r => r.json())
    setTickets(prev => prev.map(t => t.id === ticketId ? fresh : t))
    if (selected?.id === ticketId) setSelected(fresh)
  }

  async function deleteTicket(ticketId: string) {
    const allowed = await confirm({
      title: 'Delete Ticket?',
      message: 'This will permanently delete the ticket and all replies.',
      confirmLabel: 'Delete Ticket',
      tone: 'danger',
    })
    if (!allowed) return
    await fetch(`/api/support/tickets/${ticketId}`, { method: 'DELETE' })
    setTickets(prev => prev.filter(t => t.id !== ticketId))
    if (selected?.id === ticketId) setSelected(null)
  }

  async function handleEditReply(replyId: string, newContent: string) {
    if (!selected || !newContent.trim()) return
    setSavingReply(true)
    try {
      const res = await fetch(`/api/support/tickets/${selected.id}/replies`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyId, content: newContent }),
      })
      const updatedReply = await res.json()
      if (!res.ok) throw new Error(updatedReply.error || 'Failed to edit reply')

      setSelected(prev => prev ? {
        ...prev,
        replies: prev.replies.map(r => r.id === replyId ? { ...r, content: newContent } : r)
      } : null)
      setTickets(prev => prev.map(t => t.id === selected.id ? {
        ...t,
        replies: t.replies.map(r => r.id === replyId ? { ...r, content: newContent } : r)
      } : t))
      setEditingReplyId(null)
      setEditReplyText('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to edit reply')
    }
    setSavingReply(false)
  }

  async function handleDeleteReply(replyId: string) {
    if (!selected) return
    const allowed = await confirm({
      title: 'Delete Reply?',
      message: 'Are you sure you want to delete this reply?',
      confirmLabel: 'Delete Reply',
      tone: 'danger',
    })
    if (!allowed) return

    try {
      const res = await fetch(`/api/support/tickets/${selected.id}/replies`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete reply')

      setSelected(prev => prev ? {
        ...prev,
        replies: prev.replies.filter(r => r.id !== replyId)
      } : null)
      setTickets(prev => prev.map(t => t.id === selected.id ? {
        ...t,
        replies: t.replies.filter(r => r.id !== replyId)
      } : t))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete reply')
    }
  }

  // ── feature request actions ───────────────────────────────────────────
  function handleFeatureImageAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (featureImages.length + files.length > 5) { alert('Maximum 5 images allowed'); return }
    setFeatureImages(prev => [...prev, ...files])
    files.forEach(f => {
      const reader = new FileReader()
      reader.onload = () => setFeatureImagePreviews(prev => [...prev, reader.result as string])
      reader.readAsDataURL(f)
    })
    if (featureImageRef.current) featureImageRef.current.value = ''
  }

  function removeFeatureImage(idx: number) {
    setFeatureImages(prev => prev.filter((_, i) => i !== idx))
    setFeatureImagePreviews(prev => prev.filter((_, i) => i !== idx))
  }

  async function submitFeatureRequest() {
    if (!featureForm.title.trim() || !featureForm.description.trim()) return
    setSubmittingFeature(true)
    try {
      const uploadedUrls: string[] = []
      for (const file of featureImages) {
        const url = await uploadImage(file)
        uploadedUrls.push(url)
      }
      await fetch('/api/support/feature-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: featureForm.title, description: featureForm.description, imageUrls: uploadedUrls }),
      })
      setShowFeatureModal(false)
      setFeatureForm({ title: '', description: '' })
      setFeatureImages([])
      setFeatureImagePreviews([])
      // Refresh list
      const fresh = await fetch('/api/support/feature-requests').then(r => r.json())
      setFeatureRequests(Array.isArray(fresh) ? fresh : [])
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit feature request')
    }
    setSubmittingFeature(false)
  }

  async function updateFeatureStatus(id: string, status: string) {
    await fetch('/api/support/feature-requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    const fresh = await fetch('/api/support/feature-requests').then(r => r.json())
    setFeatureRequests(Array.isArray(fresh) ? fresh : [])
  }

  // ── chat actions ────────────────────────────────────────────────────────
  async function startChat(initialMessage?: string) {
    const chat = await fetch('/api/support/live-chats', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialMessage })
    }).then(r => r.json())
    setAllChats(prev => [chat, ...prev])
    setActiveChatId(chat.id)
    setView('chat')
    setShowChatStart(false)
    setChatInitText('')
  }

  async function joinChat(chatId: string) {
    await fetch(`/api/support/live-chats/${chatId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join' }) })
    setActiveChatId(chatId)
    setAllChats(prev => prev.map(c => c.id === chatId ? { ...c, status: 'ACTIVE' } : c))
  }

  async function closeChat(chatId: string) {
    await fetch(`/api/support/live-chats/${chatId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'close' }) })
    setAllChats(prev => prev.filter(c => c.id !== chatId))
    if (activeChatId === chatId) setActiveChatId(null)
  }

  function handleChatImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Image too large. Max 5MB.'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { alert('Only JPG, PNG, WEBP allowed.'); return }
    setPendingChatImage(file)
    setPendingChatImagePreview(URL.createObjectURL(file))
  }

  function clearChatImage() {
    setPendingChatImage(null)
    if (pendingChatImagePreview) URL.revokeObjectURL(pendingChatImagePreview)
    setPendingChatImagePreview(null)
    if (chatImageRef.current) chatImageRef.current.value = ''
  }

  function handleReplyImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Image too large. Max 5MB.'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { alert('Only JPG, PNG, WEBP allowed.'); return }
    setPendingReplyImage(file)
    setPendingReplyImagePreview(URL.createObjectURL(file))
  }

  function clearReplyImage() {
    setPendingReplyImage(null)
    if (pendingReplyImagePreview) URL.revokeObjectURL(pendingReplyImagePreview)
    setPendingReplyImagePreview(null)
    if (replyImageRef.current) replyImageRef.current.value = ''
  }

  async function uploadImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const token = Math.random().toString()
      window.dispatchEvent(new CustomEvent('app-upload-start', { detail: { fileName: file.name, token } }))

      const xhr = new XMLHttpRequest()
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100)
          window.dispatchEvent(new CustomEvent('app-upload-progress', { detail: { pct } }))
        }
      }
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText)
            window.dispatchEvent(new CustomEvent('app-upload-complete'))
            resolve(res.url)
          } catch (e) {
            window.dispatchEvent(new CustomEvent('app-upload-error'))
            reject(new Error('Invalid response format'))
          }
        } else {
          try {
            const res = JSON.parse(xhr.responseText)
            window.dispatchEvent(new CustomEvent('app-upload-error'))
            reject(new Error(res.error || 'Upload failed'))
          } catch (e) {
            window.dispatchEvent(new CustomEvent('app-upload-error'))
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        }
      }
      
      xhr.onerror = () => {
        window.dispatchEvent(new CustomEvent('app-upload-error'))
        reject(new Error('Network error'))
      }
      
      xhr.onabort = () => {
        window.dispatchEvent(new CustomEvent('app-upload-error'))
        reject(new Error('Upload cancelled'))
      }
      
      const handleCancel = (e: any) => {
        if (e.detail?.token === token) {
          xhr.abort()
        }
      }
      window.addEventListener('app-upload-cancel', handleCancel)
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'announcements')
      
      xhr.open('POST', '/api/upload/chat-image')
      xhr.send(formData)
    })
  }

  async function sendChatMsg() {
    if ((!chatInput.trim() && !pendingChatImage) || !activeChatId) return
    setUploadingImage(true)
    try {
      let imageUrl: string | null = null
      if (pendingChatImage) imageUrl = await uploadImage(pendingChatImage)
      await fetch(`/api/support/live-chats/${activeChatId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: chatInput, imageUrl }) })
      setChatInput('')
      clearChatImage()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send message')
    }
    setUploadingImage(false)
  }

  // ── FAQ actions ──────────────────────────────────────────────────────────
  async function saveFaq() {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) return
    if (editingFaq) {
      await fetch(`/api/support/faq/${editingFaq.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...faqForm, order: editingFaq.order }) })
    } else {
      await fetch('/api/support/faq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...faqForm, order: faqs.length }) })
    }
    setShowFaqForm(false); setEditingFaq(null); setFaqForm({ question: '', answer: '' })
    loadFaqs()
  }

  async function deleteFaq(id: string) {
    const allowed = await confirm({
      title: 'Delete FAQ?',
      message: 'This FAQ item will be removed permanently.',
      confirmLabel: 'Delete FAQ',
      tone: 'danger',
    })
    if (!allowed) return
    await fetch(`/api/support/faq/${id}`, { method: 'DELETE' })
    setFaqs(prev => prev.filter(f => f.id !== id))
  }

  // ── chat history (manager) ───────────────────────────────────────────────
  async function loadChatHistory() {
    const data = await fetch('/api/support/chat-history').then(r => r.json())
    setHistoryChats(Array.isArray(data) ? data : [])
    setView('chatHistory')
  }

  async function viewHistory(s: ChatSession) {
    setSelectedHistory(s)
    const msgs = await fetch(`/api/support/chat-history/${s.id}`).then(r => r.json())
    setHistoryMsgs(Array.isArray(msgs) ? msgs : [])
  }

  async function deleteHistory(id: string) {
    const allowed = await confirm({
      title: 'Delete Chat History?',
      message: 'This chat transcript will be removed permanently.',
      confirmLabel: 'Delete Transcript',
      tone: 'danger',
    })
    if (!allowed) return
    await fetch(`/api/support/chat-history/${id}`, { method: 'DELETE' })
    setHistoryChats(prev => prev.filter(c => c.id !== id))
    if (selectedHistory?.id === id) { setSelectedHistory(null); setHistoryMsgs([]) }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // HOME VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (view === 'home') {
    return (
      <div className="page-container fade-in" style={{ maxHeight: isMobile ? 'calc(100vh - 72px)' : 'calc(100vh - 104px)', overflowY: 'auto', overflowX: 'hidden' }}>
        <style>{`
          .mobile-back-header {
            display: none !important;
          }
          .support-grid {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 24px;
            margin-bottom: 24px;
            align-items: flex-start;
          }
          .faq-card-col {
            display: flex;
            flex-direction: column;
            order: 0;
            padding: 28px;
          }
          .chat-actions-col {
            display: flex;
            flex-direction: column;
            gap: 24px;
            order: 0;
          }
          .chat-box-pad {
            padding: 28px;
          }
          .ticket-box-pad {
            padding: 24px;
          }
          @media (max-width: 767px) {
            .mobile-back-header {
              display: flex !important;
            }
            .page-container {
              padding: 16px 14px 24px !important;
              overflow-x: hidden !important;
            }
            .support-grid {
              grid-template-columns: 1fr !important;
              gap: 16px !important;
            }
            .faq-card-col {
              order: 2 !important;
              padding: 16px !important;
            }
            .chat-actions-col {
              order: 1 !important;
              gap: 16px !important;
            }
            .chat-box-pad {
              padding: 16px !important;
            }
            .ticket-box-pad {
              padding: 16px !important;
            }
          }
        `}</style>
        {confirmDialog}

        {/* Mobile-only Header with Back Button */}
        <div className="mobile-back-header" style={{
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          padding: '8px 4px 16px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}>
          <button
            onClick={() => router.back()}
            style={{
              background: 'var(--surface-2)',
              boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
              border: 'none',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              transition: 'transform 0.15s ease',
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div>
            <span style={{ display: 'block', fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', 'Nunito', sans-serif", letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              Contact & Support
            </span>
            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Raise a ticket or chat with support
            </span>
          </div>
        </div>

        <div className="support-grid">

          {/* FAQ Card (Left Side on desktop, last on mobile) */}
          <div className="faq-card-col" style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3636e8" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              {(userRole === 'MANAGER' || userRole === 'ADMIN') && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Reset to Master FAQs?',
                        message: 'This will replace all FAQ questions with the official master list.',
                        confirmLabel: 'Reset FAQs',
                        tone: 'danger',
                      })
                      if (!ok) return
                      await fetch('/api/support/faq', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'RESET_DEFAULTS' }),
                      })
                      loadFaqs()
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ borderRadius: '50px', fontSize: '11px', padding: '6px 12px' }}
                  >
                    Reset Defaults
                  </button>
                  <button onClick={() => { setFaqForm({ question: '', answer: '' }); setEditingFaq(null); setShowFaqForm(true) }} className="btn btn-primary btn-sm" style={{ borderRadius: '50px' }}>
                    + Add FAQ
                  </button>
                </div>
              )}
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>Frequently Asked Questions</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '18px' }}>
              Instant answers to common queries. Browse our knowledge base for solutions.
            </p>

            {/* FAQ accordion */}
            <div style={{ flex: 1 }}>
              {faqs.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No FAQs yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {faqs.map(f => (
                    <div key={f.id} style={{ borderRadius: '16px', border: '1.5px solid var(--border)', overflow: 'hidden' }}>
                      <div 
                        onClick={() => setExpandedFaq(expandedFaq === f.id ? null : f.id)}
                        style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: expandedFaq === f.id ? 'var(--surface-2)' : 'var(--surface)', transition: 'background 0.2s' }}
                      >
                        <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>{f.question}</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {(userRole === 'MANAGER' || userRole === 'ADMIN') && (
                            <>
                              <button onClick={e => { e.stopPropagation(); setFaqForm({ question: f.question, answer: f.answer }); setEditingFaq(f); setShowFaqForm(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                              </button>
                              <button onClick={e => { e.stopPropagation(); deleteFaq(f.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                              </button>
                            </>
                          )}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9999b0" strokeWidth="2.5" style={{ transform: expandedFaq === f.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </div>
                      {expandedFaq === f.id && (
                        <div style={{ padding: '0 18px 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'var(--surface-2)', whiteSpace: 'pre-wrap' }}>
                          {f.answer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (Chat + Tickets) — first on mobile */}
          <div className="chat-actions-col">
            
            {/* Live Chat Card — REMOVED (backed up in scratch/live-chat-backup/) */}

            {/* Raise a Ticket Box (History merged inside) */}
            <div className="ticket-box-pad" style={{ width: '100%', borderRadius: '24px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', boxShadow: 'inset 0 1px 0 var(--neu-glow)', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.03em', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Raise a Ticket
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Send a ticket for follow-up issues.
                  </div>
                </div>
                {(userRole === 'STUDENT' || userRole === 'ADMIN') ? (
                  hasReachedActiveLimit ? (
                    <button 
                      disabled 
                      title="You already have 3 active tickets. Please wait until your existing tickets are resolved or closed."
                      className="btn" 
                      style={{ borderRadius: '50px', padding: '10px 18px', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'not-allowed', opacity: 0.8, fontSize: '12px', fontWeight: '700' }}
                    >
                      Limit Reached (3/3 Active)
                    </button>
                  ) : (
                    <button onClick={() => { setTicketError(null); setShowCreate(true) }} className="btn btn-primary" style={{ borderRadius: '50px', padding: '10px 20px' }}>+ New Ticket</button>
                  )
                ) : (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Review tickets below</div>
                )}
              </div>

              {hasReachedActiveLimit && (
                <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>You have 3 active tickets. You cannot create a new ticket until a manager resolves or closes an existing ticket.</span>
                </div>
              )}

              {/* History Section inside the box */}
              <div style={{ marginTop: '20px', borderTop: '1px solid #d9dcff', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>Recent History</h3>
                  <button onClick={() => { setSelected(null); setView('allTickets') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    View All →
                  </button>
                </div>

                {tickets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '12px' }}>No tickets raised yet.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {tickets.slice(0, 5).map((t) => (
                      <div key={t.id} onClick={() => { setSelected(t); setView('allTickets') }}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--surface)', borderRadius: '16px', cursor: 'pointer', border: '1px solid var(--border)' }}
                      >
                        <TicketStatusIcon status={t.status} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{getRelativeTime(t.updatedAt, t.status)}</div>
                        </div>
                        <span style={{ ...pill(STATUS_COLORS[t.status]), fontSize: '10px', padding: '2px 8px' }}>{t.status.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {userRole === 'MANAGER' && (
              <div className="ticket-box-pad" style={{ width: '100%', borderRadius: '24px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', boxShadow: 'inset 0 1px 0 var(--neu-glow)', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--danger)', letterSpacing: '0.03em', marginBottom: '4px', textTransform: 'uppercase' }}>
                      User Reports
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      {`${userReports.length} report${userReports.length !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <button onClick={() => setView('userReports')} className="btn btn-ghost" style={{ borderRadius: '50px', padding: '10px 16px', color: 'var(--danger)' }}>
                    View All Reports
                  </button>
                </div>
              </div>
            )}

            {/* Request a Feature Box */}
            {userRole !== 'ADMIN' && (
              <div className="ticket-box-pad" style={{ width: '100%', borderRadius: '24px', background: 'var(--surface-2)', border: '1.5px solid var(--border)', boxShadow: 'inset 0 1px 0 var(--neu-glow)', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#8b5cf6', letterSpacing: '0.03em', marginBottom: '4px', textTransform: 'uppercase' }}>
                      💡 Request a Feature
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      Have an idea? Tell us what you&apos;d love to see.
                    </div>
                  </div>
                  <button onClick={() => setShowFeatureModal(true)} className="btn" style={{ borderRadius: '50px', padding: '10px 20px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>+ Request</button>
                </div>
                {featureRequests.length > 0 && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid rgba(139,92,246,0.15)', paddingTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Your Requests</span>
                      <button onClick={() => setView('featureRequests')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b5cf6', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit' }}>View All →</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {featureRequests.slice(0, 3).map(fr => (
                        <div key={fr.id} onClick={() => setView('featureRequests')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--surface)', borderRadius: '14px', cursor: 'pointer', border: '1px solid var(--border)' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: fr.status === 'PENDING' ? '#f59e0b' : fr.status === 'ACCEPTED' ? '#10b981' : fr.status === 'REJECTED' ? '#ef4444' : '#6366f1', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{fr.title}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fr.status} · {new Date(fr.createdAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {userRole === 'MANAGER' && (
              <button onClick={loadChatHistory} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '13px', fontWeight: '700', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '4px', alignSelf: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                View Chat History
              </button>
            )}
          </div>
        </div>

        {showCreate && (
          <CreateTicketModal 
            onClose={() => setShowCreate(false)} 
            form={form} 
            setForm={setForm} 
            classes={classes} 
            userRole={userRole} 
            submitTicket={submitTicket} 
            hasReachedActiveLimit={hasReachedActiveLimit}
            ticketError={ticketError}
            submittingTicket={submittingTicket}
          />
        )}
        {showFaqForm && (
          <FaqFormModal 
            onClose={() => { setShowFaqForm(false); setEditingFaq(null) }} 
            faqForm={faqForm} 
            setFaqForm={setFaqForm} 
            editingFaq={editingFaq} 
            saveFaq={saveFaq} 
          />
        )}
        {/* StartChatModal — REMOVED (live chat disabled) */}
        {selectedUserDetailsId && (
          <ManagerUserModal 
            userId={selectedUserDetailsId} 
            onClose={() => setSelectedUserDetailsId(null)} 
            onUpdate={loadTickets}
          />
        )}
        {showFeatureModal && (
          <div onClick={() => setShowFeatureModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: '28px', padding: '28px 24px', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>💡 Request a Feature</h2>
                <button onClick={() => setShowFeatureModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Feature Title *</label>
                  <input
                    value={featureForm.title}
                    onChange={e => setFeatureForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Dark mode for lectures"
                    maxLength={120}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Description *</label>
                  <textarea
                    value={featureForm.description}
                    onChange={e => setFeatureForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Describe the feature you'd like to see..."
                    rows={4}
                    maxLength={2000}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Screenshots (optional, max 5)</label>
                  <input ref={featureImageRef} type="file" accept="image/*" multiple onChange={handleFeatureImageAdd} style={{ display: 'none' }} />
                  <button onClick={() => featureImageRef.current?.click()} style={{ padding: '10px 16px', borderRadius: '12px', border: '1.5px dashed var(--border)', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit', width: '100%' }}>
                    📎 Add Photos ({featureImages.length}/5)
                  </button>
                  {featureImagePreviews.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                      {featureImagePreviews.map((src, i) => (
                        <div key={i} style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '10px', overflow: 'hidden' }}>
                          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button onClick={() => removeFeatureImage(i)} style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={submitFeatureRequest}
                  disabled={!featureForm.title.trim() || !featureForm.description.trim() || submittingFeature}
                  style={{ padding: '13px', borderRadius: '14px', background: (!featureForm.title.trim() || !featureForm.description.trim()) ? 'var(--text-muted)' : 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', opacity: submittingFeature ? 0.6 : 1, marginTop: '4px' }}
                >
                  {submittingFeature ? 'Submitting...' : 'Submit Feature Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FEATURE REQUESTS VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (view === 'featureRequests') {
    return (
      <div className="page-container fade-in" style={{ maxHeight: isMobile ? 'calc(100vh - 72px)' : 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <BackButton onClick={() => setView('home')} />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
              {featureRequests.length} feature request{featureRequests.length !== 1 ? 's' : ''}
            </span>
            {(userRole === 'STUDENT' || userRole === 'ADMIN') && (
              <button onClick={() => setShowFeatureModal(true)} className="btn btn-primary btn-sm" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', border: 'none', borderRadius: '50px', padding: '8px 16px' }}>
                + Request
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {featureRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <p style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>No feature requests yet</p>
              <p style={{ fontSize: '13px' }}>Be the first to share an idea with us!</p>
            </div>
          ) : (
            featureRequests.map((fr) => (
              <div key={fr.id} style={{ ...card, padding: '20px', border: '1px solid var(--border)', position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>{fr.title}</h3>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{fr.description}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    {userRole === 'MANAGER' ? (
                      <select
                        value={fr.status}
                        onChange={(e) => updateFeatureStatus(fr.id, e.target.value)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: '1.5px solid var(--border)',
                          background: 'var(--surface-2)',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: fr.status === 'PENDING' ? '#f59e0b' : fr.status === 'ACCEPTED' ? '#10b981' : fr.status === 'REJECTED' ? '#ef4444' : '#6366f1',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="REVIEWED">REVIEWED</option>
                        <option value="ACCEPTED">ACCEPTED</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    ) : (
                      <span style={{
                        ...pill(fr.status === 'PENDING' ? '#f59e0b' : fr.status === 'ACCEPTED' ? '#10b981' : fr.status === 'REJECTED' ? '#ef4444' : '#6366f1'),
                        fontSize: '10px',
                        padding: '2px 8px',
                      }}>
                        {fr.status}
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(fr.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {fr.imageUrls && fr.imageUrls.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {fr.imageUrls.map((url, i) => (
                      <div
                        key={i}
                        onClick={() => setLightboxUrl(url)}
                        style={{ width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', cursor: 'zoom-in', border: '1px solid var(--border)' }}
                      >
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {fr.user.avatar ? (
                        <img src={fr.user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 800 }}>{fr.user.name.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      {userRole === 'MANAGER' ? (
                        <button
                          onClick={() => setSelectedUserDetailsId(fr.user.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            color: 'var(--primary)',
                            fontSize: '12px',
                            fontWeight: 800,
                            textAlign: 'left',
                            textDecoration: 'underline',
                          }}
                        >
                          {fr.user.name} ({fr.user.role})
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          {fr.user.name} ({fr.user.role})
                        </span>
                      )}
                    </div>
                  </div>
                  {userRole === 'MANAGER' && fr.user.email && (
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{fr.user.email}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {showFeatureModal && (
          <div onClick={() => setShowFeatureModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: '28px', padding: '28px 24px', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>💡 Request a Feature</h2>
                <button onClick={() => setShowFeatureModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Feature Title *</label>
                  <input
                    value={featureForm.title}
                    onChange={e => setFeatureForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Dark mode for lectures"
                    maxLength={120}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Description *</label>
                  <textarea
                    value={featureForm.description}
                    onChange={e => setFeatureForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Describe the feature you'd like to see..."
                    rows={4}
                    maxLength={2000}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Screenshots (optional, max 5)</label>
                  <input ref={featureImageRef} type="file" accept="image/*" multiple onChange={handleFeatureImageAdd} style={{ display: 'none' }} />
                  <button onClick={() => featureImageRef.current?.click()} style={{ padding: '10px 16px', borderRadius: '12px', border: '1.5px dashed var(--border)', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'inherit', width: '100%' }}>
                    📎 Add Photos ({featureImages.length}/5)
                  </button>
                  {featureImagePreviews.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                      {featureImagePreviews.map((src, i) => (
                        <div key={i} style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '10px', overflow: 'hidden' }}>
                          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button onClick={() => removeFeatureImage(i)} style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={submitFeatureRequest}
                  disabled={!featureForm.title.trim() || !featureForm.description.trim() || submittingFeature}
                  style={{ padding: '13px', borderRadius: '14px', background: (!featureForm.title.trim() || !featureForm.description.trim()) ? 'var(--text-muted)' : 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', opacity: submittingFeature ? 0.6 : 1, marginTop: '4px' }}
                >
                  {submittingFeature ? 'Submitting...' : 'Submit Feature Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (view === 'userReports') {
    const canManageReports = userRole === 'MANAGER' || userRole === 'ADMIN'
    return (
      <div className="page-container fade-in" style={{ maxHeight: isMobile ? 'calc(100vh - 72px)' : 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column' }}>
        {confirmDialog}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
          <BackButton onClick={() => setView('home')} />
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700' }}>{userReports.length} report{userReports.length !== 1 ? 's' : ''}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingBottom: '12px' }}>
          {userReports.length === 0 ? (
            <div className="empty-state">
              <p style={{ fontWeight: 800, fontSize: '15px', marginBottom: '4px' }}>No reports</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nothing to review here.</p>
            </div>
          ) : userReports.map(report => (
            <div key={report.id} style={{ padding: '16px', borderRadius: '20px', ...neu, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={pill(report.status === 'NEW' ? 'var(--danger)' : report.status === 'UNDER_REVIEW' ? 'var(--warning)' : report.status === 'RESOLVED' ? 'var(--success)' : 'var(--text-muted)')}>
                      {report.status.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {formatIST(report.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)' }}>{formatReportReason(report.reason)}</div>
                  {report.subReason && (
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '3px' }}>{report.subReason}</div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : canManageReports ? '1fr 1fr' : '1fr', gap: '10px' }}>
                <div style={{ padding: '12px', borderRadius: '14px', background: 'var(--surface)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '8px' }}>Reported User</div>
                  <button
                    onClick={() => canManageReports && setSelectedUserDetailsId(report.reportedUser.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', border: 'none', background: 'transparent', padding: 0, cursor: canManageReports ? 'pointer' : 'default', textAlign: 'left' }}
                  >
                    <UserAvatar user={report.reportedUser} size={32} />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: canManageReports ? 'var(--primary)' : 'var(--text-primary)' }}>{report.reportedUser.name}</span>
                  </button>
                </div>
                {canManageReports && report.reporter && (
                  <div style={{ padding: '12px', borderRadius: '14px', background: 'var(--surface)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '8px' }}>Reporter</div>
                    <button
                      onClick={() => setSelectedUserDetailsId(report.reporter!.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                    >
                      <UserAvatar user={report.reporter} size={32} />
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{report.reporter.name}</span>
                    </button>
                  </div>
                )}
              </div>

              {report.details && (
                <div style={{ padding: '12px', borderRadius: '14px', background: 'var(--surface)', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                  {report.details}
                </div>
              )}
              {report.reviewNote && (
                <div style={{ padding: '12px', borderRadius: '14px', background: 'var(--surface)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {report.reviewNote}
                </div>
              )}

              {canManageReports && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['NEW', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'].map(status => (
                    <button
                      key={status}
                      onClick={() => updateReportStatus(report.id, status)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '50px',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: report.status === status ? 'var(--primary)' : 'var(--surface-2)',
                        color: report.status === status ? '#fff' : 'var(--text-muted)',
                        boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)',
                      }}
                    >
                      {status.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedUserDetailsId && (
          <ManagerUserModal
            userId={selectedUserDetailsId}
            onClose={() => setSelectedUserDetailsId(null)}
            onUpdate={loadTickets}
          />
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ALL TICKETS VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (view === 'allTickets') {
    return (
      <div className="page-container fade-in" style={{ maxHeight: isMobile ? 'calc(100vh - 72px)' : 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column' }}>
        {confirmDialog}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <BackButton onClick={() => { if (isMobile && selected) { setSelected(null) } else { setView('home'); setSelected(null) } }} />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</span>
            {(userRole === 'STUDENT' || userRole === 'ADMIN') && (
              <button 
                onClick={() => { if (!hasReachedActiveLimit) { setTicketError(null); setShowCreate(true) } }} 
                disabled={hasReachedActiveLimit}
                className="btn btn-primary btn-sm"
                style={hasReachedActiveLimit ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                title={hasReachedActiveLimit ? 'Active ticket limit reached (3/3). Wait for resolution or closure.' : undefined}
              >
                {hasReachedActiveLimit ? 'Limit Reached (3/3)' : '+ New Ticket'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (selected ? '1fr 1.3fr' : '1fr'), gap: '20px', flex: 1, minHeight: 0 }}>
          {/* Ticket list */}
          <div style={{ display: (isMobile && selected) ? 'none' : 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
            {tickets.length === 0 ? (
              <div className="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                <p style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>No tickets</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{(userRole === 'STUDENT' || userRole === 'ADMIN') ? 'Create a ticket to get help. If assigned tickets, they will appear here.' : 'No tickets have been raised.'}</p>
              </div>
            ) : tickets.map(t => (
              <div key={t.id} onClick={() => setSelected(selected?.id === t.id ? null : t)}
                style={{ padding: '14px 18px', borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s', ...neu, outline: selected?.id === t.id ? '2px solid #3636e8' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={pill(STATUS_COLORS[t.status])}>{t.status.replace('_', ' ')}</span>
                      <span style={pill(PRIORITY_COLORS[t.priority])}>{t.priority}</span>
                      {userRole === 'MANAGER' ? (
                        t.type === 'GENERAL' ? (
                          <span style={pill('var(--info)')}>General</span>
                        ) : (
                          t.class && <span style={pill(t.class.color)}>{t.class.name}</span>
                        )
                      ) : (
                        t.class && <span style={pill(t.class.color)}>{t.class.name}</span>
                      )}
                      {t.assignedTo && (
                        <span style={{ ...pill('var(--primary)'), display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          {t.assignedTo.name}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{formatIST(t.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                    {userRole === 'MANAGER' && (
                      <button onClick={e => { e.stopPropagation(); deleteTicket(t.id) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '2px', display: 'flex' }} title="Delete ticket">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {t.replies.length} repl{t.replies.length !== 1 ? 'ies' : 'y'} · by <span 
                    onClick={(e) => {
                      if (userRole === 'MANAGER') {
                        e.stopPropagation()
                        setSelectedUserDetailsId(t.user.id)
                      }
                    }}
                    style={{ 
                      cursor: userRole === 'MANAGER' ? 'pointer' : 'default',
                      textDecoration: userRole === 'MANAGER' ? 'underline' : 'none',
                      color: userRole === 'MANAGER' ? 'var(--primary)' : 'inherit'
                    }}
                  >{t.user.name}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Ticket thread */}
          {selected && (
            <div style={{ borderRadius: '24px', ...neu, display: (isMobile && !selected) ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 200px)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1.5px solid rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>{selected.title}</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={pill(STATUS_COLORS[selected.status])}>{selected.status.replace('_', ' ')}</span>
                      <span style={pill(PRIORITY_COLORS[selected.priority])}>{selected.priority}</span>
                      {selected.assignedTo && (
                        <span style={{ ...pill('var(--primary)'), display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          → {selected.assignedTo.name}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                      )}
                      {userRole === 'MANAGER' ? (
                        selected.type === 'GENERAL' ? (
                          <span style={pill('var(--info)')}>📋 General</span>
                        ) : (
                          selected.class && <span style={pill(selected.class.color)}>📚 {selected.class.name}</span>
                        )
                      ) : (
                        selected.class && <span style={pill(selected.class.color)}>📚 {selected.class.name}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>

                {/* Manager controls */}
                {userRole === 'MANAGER' && (
                  <>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                      {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(s => (
                        <button key={s} onClick={() => updateStatus(selected.id, s)} style={{ padding: '4px 10px', borderRadius: '50px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', background: selected.status === s ? STATUS_COLORS[s] : 'var(--surface-2)', color: selected.status === s ? '#fff' : 'var(--text-muted)', boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)' }}>
                          {s.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                    {admins.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', flexShrink: 0 }}>Assign to:</span>
                        <select
                          value={selected.assignedTo?.id || ''}
                          onChange={e => assignTicket(selected.id, e.target.value)}
                          style={{ flex: 1, padding: '6px 10px', borderRadius: '10px', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '12.5px', background: 'var(--surface-2)', boxShadow: '2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light)', color: 'var(--text-primary)', cursor: 'pointer' }}
                        >
                          <option value="">Unassigned</option>
                          {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    )}
                  </>
                )}


              </div>

              <div style={{ padding: '14px 20px', borderBottom: '1.5px solid var(--border)', background: 'var(--surface-2)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>
                  Original request — <span 
                    onClick={() => {
                      if (userRole === 'MANAGER') setSelectedUserDetailsId(selected.user.id)
                    }}
                    style={{ 
                      cursor: userRole === 'MANAGER' ? 'pointer' : 'default',
                      textDecoration: userRole === 'MANAGER' ? 'underline' : 'none',
                      color: userRole === 'MANAGER' ? 'var(--primary)' : 'inherit'
                    }}
                  >{selected.user.name}</span>
                  {selected.createdAt && ` · Raised: ${formatIST(selected.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`}
                </div>
                <div style={{ fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: '1.6' }}>{selected.description}</div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selected.replies.map((r, idx) => {
                  const isMe = r.sender.id === userId
                  const isAdmin = r.sender.role !== 'STUDENT'
                  const showAvatar = idx === 0 || selected.replies[idx - 1]?.sender.id !== r.sender.id
                  const canManageReply = isMe && (userRole === 'MANAGER' || userRole === 'ADMIN')
                  const isEditingThisReply = editingReplyId === r.id

                  return (
                    <div key={r.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: '8px', alignItems: 'flex-start', marginBottom: showAvatar ? '8px' : '2px' }}>
                      {!isMe && (
                        <UserAvatar
                          user={r.sender}
                          size={28}
                          onClick={() => userRole === 'MANAGER' && setSelectedUserDetailsId(r.sender.id)}
                          style={{ display: showAvatar ? 'inline-flex' : 'none' }}
                        />
                      )}
                      {!isMe && !showAvatar && <div style={{ width: '28px', flexShrink: 0 }} />}
                      <div style={{ maxWidth: '78%', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        
                        {canManageReply && !isEditingThisReply && (
                          <div style={{ display: 'flex', gap: '4px', marginBottom: '2px', opacity: 0.85 }}>
                            <button
                              onClick={() => {
                                setEditingReplyId(r.id)
                                setEditReplyText(r.content)
                              }}
                              title="Edit reply"
                              aria-label="Edit reply"
                              style={{
                                background: 'rgba(54,54,232,0.08)',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--primary)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '11px',
                                fontWeight: '600',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteReply(r.id)}
                              title="Delete reply"
                              aria-label="Delete reply"
                              style={{
                                background: 'rgba(239,68,68,0.08)',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#ef4444',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '11px',
                                fontWeight: '600',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                              Delete
                            </button>
                          </div>
                        )}

                        <div className="chat-msg-bubble" style={{ 
                          padding: isEditingThisReply ? '10px 12px' : r.imageUrl ? '6px 6px 20px 6px' : '8px 12px 20px 12px', 
                          borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', 
                          background: isMe ? '#dcf8c6' : isAdmin ? '#e0e7ff' : '#ffffff', 
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)', 
                          color: '#1e1e3a',
                          border: isMe ? 'none' : '1px solid var(--border)',
                          minWidth: '60px'
                        }}>
                          {!isMe && showAvatar && (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', fontWeight: '800', marginBottom: '4px', color: isAdmin ? 'var(--primary)' : '#888', textTransform: 'uppercase' }}>
                              <span 
                                onClick={() => {
                                  if (userRole === 'MANAGER') setSelectedUserDetailsId(r.sender.id)
                                }}
                                style={{ 
                                  cursor: userRole === 'MANAGER' ? 'pointer' : 'default',
                                  textDecoration: userRole === 'MANAGER' ? 'underline' : 'none'
                                }}
                              >{r.sender.name}</span>
                              {isAdmin && <StaffRoleBadge role={r.sender.role} />}
                            </div>
                          )}

                          {isEditingThisReply ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
                              <textarea
                                value={editReplyText}
                                onChange={(e) => setEditReplyText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    setEditingReplyId(null)
                                  }
                                }}
                                autoFocus
                                style={{
                                  width: '100%',
                                  minHeight: '60px',
                                  padding: '8px',
                                  borderRadius: '8px',
                                  border: '1.5px solid var(--primary)',
                                  background: '#ffffff',
                                  color: '#1e1e3a',
                                  fontSize: '13.5px',
                                  resize: 'vertical',
                                  outline: 'none'
                                }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                <button
                                  onClick={() => setEditingReplyId(null)}
                                  style={{
                                    padding: '3px 10px',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                    border: '1px solid #ccc',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    color: '#475569'
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleEditReply(r.id, editReplyText)}
                                  disabled={!editReplyText.trim() || savingReply}
                                  style={{
                                    padding: '3px 12px',
                                    fontSize: '12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'var(--primary)',
                                    color: '#ffffff',
                                    cursor: editReplyText.trim() && !savingReply ? 'pointer' : 'default',
                                    opacity: editReplyText.trim() && !savingReply ? 1 : 0.6,
                                    fontWeight: '700'
                                  }}
                                >
                                  {savingReply ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {r.imageUrl && (
                                <img
                                  src={r.imageUrl}
                                  alt="Attached image"
                                  onClick={() => setLightboxUrl(r.imageUrl!)}
                                  style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '10px', cursor: 'pointer', display: 'block', objectFit: 'cover', marginBottom: r.content ? '6px' : '0' }}
                                />
                              )}
                              {r.content && <div style={{ fontSize: '13.5px', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.content}</div>}
                              
                              {/* Time inside bubble */}
                              <div style={{ position: 'absolute', bottom: '4px', right: '8px', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                {formatIST(r.createdAt, { hour: '2-digit', minute: '2-digit', hour12: true })}
                                {isMe && (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4fc3f7" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={repliesEndRef} />
              </div>

              {selected.status !== 'CLOSED' && (
                <div style={{ padding: '12px 16px', borderTop: '1.5px solid rgba(0,0,0,0.06)' }}>
                  {pendingReplyImagePreview && (
                    <div style={{ marginBottom: '10px', position: 'relative', display: 'inline-flex', alignItems: 'flex-end', gap: '8px', padding: '10px 14px', borderRadius: '16px', background: 'var(--primary-light)', border: '2px solid #3636e830', boxShadow: '0 4px 12px rgba(54,54,232,0.1)' }}>
                      <img src={pendingReplyImagePreview} alt="Preview" style={{ maxHeight: '80px', maxWidth: '160px', borderRadius: '10px', objectFit: 'cover' }} />
                      <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '600' }}>📎 Ready to send</div>
                      <button onClick={clearReplyImage} style={{ position: 'absolute', top: '-8px', right: '-8px', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--danger)', color: '#fff', border: '2px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}>✕</button>
                    </div>
                  )}
                  {uploadingImage && <div style={{ marginBottom: '6px', fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>Uploading...</div>}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="file" accept="image/jpeg,image/png,image/webp" ref={replyImageRef} onChange={handleReplyImageSelect} style={{ display: 'none' }} />
                    <button onClick={() => replyImageRef.current?.click()} disabled={uploadingImage} title="Attach image" style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: pendingReplyImage ? 'var(--primary-light)' : 'var(--surface-2)', boxShadow: '3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: pendingReplyImage ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </button>
                    <input value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()} placeholder="Type your reply..." disabled={uploadingImage} style={{ flex: 1, padding: '10px 16px', borderRadius: '50px', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '13.5px', ...neuInset, color: 'var(--text-primary)' }} />
                    <button onClick={sendReply} disabled={(!replyText.trim() && !pendingReplyImage) || uploadingImage} className="btn btn-primary btn-sm" style={{ borderRadius: '50px', padding: '10px 18px', opacity: (!replyText.trim() && !pendingReplyImage) || uploadingImage ? 0.6 : 1 }}>Send</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {showCreate && (
          <CreateTicketModal 
            onClose={() => setShowCreate(false)} 
            form={form} 
            setForm={setForm} 
            classes={classes} 
            userRole={userRole} 
            submitTicket={submitTicket} 
            hasReachedActiveLimit={hasReachedActiveLimit}
            ticketError={ticketError}
            submittingTicket={submittingTicket}
          />
        )}
        {/* StartChatModal — REMOVED (live chat disabled) */}
        {selectedUserDetailsId && (
          <ManagerUserModal 
            userId={selectedUserDetailsId} 
            onClose={() => setSelectedUserDetailsId(null)} 
            onUpdate={loadTickets}
          />
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CHAT HISTORY VIEW (Manager only)
  // ══════════════════════════════════════════════════════════════════════════
  if (view === 'chatHistory') {
    return (
      <div className="page-container fade-in" style={{ maxHeight: isMobile ? 'calc(100vh - 72px)' : 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column' }}>
        {confirmDialog}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <BackButton onClick={() => { if (isMobile && selectedHistory) { setSelectedHistory(null) } else { setView('chat'); setSelectedHistory(null) } }} />
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>{historyChats.length} transcript{historyChats.length !== 1 ? 's' : ''}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (selectedHistory ? '320px 1fr' : '1fr'), gap: '20px', flex: 1, minHeight: 0 }}>
          {/* History list */}
          <div style={{ display: (isMobile && selectedHistory) ? 'none' : 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
            {historyChats.length === 0 ? (
              <div className="empty-state">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                <p style={{ fontWeight: '700', marginTop: '10px' }}>No chat history</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Closed chat transcripts will appear here.</p>
              </div>
            ) : historyChats.map(c => (
              <div key={c.id}
                onClick={() => viewHistory(c)}
                style={{ padding: '14px 16px', borderRadius: '18px', cursor: 'pointer', ...neu, outline: selectedHistory?.id === c.id ? '2px solid #3636e8' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div 
                      onClick={(e) => {
                        if (userRole === 'MANAGER') {
                          e.stopPropagation()
                          setSelectedUserDetailsId(c.student.id)
                        }
                      }}
                      style={{ 
                        fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '2px',
                        cursor: userRole === 'MANAGER' ? 'pointer' : 'default',
                        textDecoration: userRole === 'MANAGER' ? 'underline' : 'none'
                      }}
                    >{c.student.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {c.agent ? `Agent: ${c.agent.name}` : 'No agent joined'}
                      {c._count && ` · ${c._count.messages} messages`}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{new Date((c as ChatSession & { updatedAt?: string }).updatedAt || '').toLocaleString()}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteHistory(c.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '2px', flexShrink: 0 }} title="Delete transcript">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Transcript viewer */}
          {selectedHistory && (
            <div style={{ borderRadius: '24px', ...neu, display: (isMobile && !selectedHistory) ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1.5px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text-primary)' }}>Chat with {selectedHistory.student.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedHistory.agent ? `Agent: ${selectedHistory.agent.name}` : 'No agent'} · Transcript
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={pill('var(--text-muted)')}>Closed</span>
                  <button onClick={() => { setSelectedHistory(null); setHistoryMsgs([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {historyMsgs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '20px' }}>No messages in this transcript.</div>
                ) : historyMsgs.map(m => {
                  const isStudent = m.sender.role === 'STUDENT'
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: isStudent ? 'flex-start' : 'flex-end', gap: '8px', alignItems: 'flex-end' }}>
                      {isStudent && <UserAvatar user={m.sender} size={28} />}
                      <div style={{ maxWidth: '70%', padding: '10px 14px', borderRadius: isStudent ? '18px 18px 18px 4px' : '18px 18px 4px 18px', background: isStudent ? 'var(--surface-2)' : 'var(--primary-light)', boxShadow: '3px 3px 8px var(--neu-dark), -3px -3px 8px var(--neu-light)', color: 'var(--text-primary)' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '3px', color: isStudent ? 'var(--text-muted)' : 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {m.sender.name}
                          {!isStudent && (
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '2px',
                              padding: '1px 5px',
                              borderRadius: '50px',
                              background: 'linear-gradient(135deg, #3636e8, #6366f1)',
                              color: '#fff',
                              fontSize: '8px',
                              fontWeight: '800',
                              textTransform: 'capitalize'
                            }}>
                              {m.sender.role.toLowerCase()}
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13.5px', lineHeight: '1.5' }}>{m.content}</div>
                        <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.6, textAlign: 'right' }}>{formatIST(m.createdAt, { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        {selectedUserDetailsId && (
          <ManagerUserModal 
            userId={selectedUserDetailsId} 
            onClose={() => setSelectedUserDetailsId(null)} 
            onUpdate={loadTickets}
          />
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIVE CHAT VIEW — DISABLED (backed up in scratch/live-chat-backup/)
  return null
}
