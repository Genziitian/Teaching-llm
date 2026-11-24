// Shared types, status config and API client for the native 1:1 bookings manager.
// All calls go to the existing /api/storefront/1on1-bookings/* routes (manager-guarded server-side).
import { Ban, CalendarClock, CheckCircle2, Clock, Ghost, XCircle, AlertCircle, type LucideIcon } from 'lucide-react'

export type BookingStatus = 'CONFIRMED' | 'RESCHEDULED' | 'COMPLETED' | 'TRY_LATER' | 'GHOSTED' | 'NOT_INTERESTED' | 'CANCELLED'

export interface Booking {
  id: string
  name: string
  email: string
  phone: string
  level: string
  subjects: string
  slot_date: string
  slot_time: string
  plan: string
  notes?: string
  user_notes?: string
  manager_notes?: string
  status: BookingStatus | string
  created_at: string
  updated_at?: string
}

export const TIME_SLOTS = [
  '10:00 AM - 10:15 AM',
  '11:00 AM - 11:15 AM',
  '12:00 PM - 12:15 PM',
  '02:00 PM - 02:15 PM',
  '03:30 PM - 03:45 PM',
  '05:00 PM - 05:15 PM',
  '06:30 PM - 06:45 PM',
  '07:30 PM - 07:45 PM',
  '08:30 PM - 08:45 PM',
  '09:15 PM - 09:30 PM',
]

export type StatusConf = { label: string; short: string; color: string; icon: LucideIcon; hint: string }

export const STATUS_ORDER: BookingStatus[] = ['CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'TRY_LATER', 'GHOSTED', 'NOT_INTERESTED', 'CANCELLED']

export const STATUS_CONFIG: Record<BookingStatus, StatusConf> = {
  CONFIRMED: { label: 'Confirmed', short: 'Confirmed', color: '#059669', icon: CheckCircle2, hint: 'Active session' },
  RESCHEDULED: { label: 'Rescheduled', short: 'Rescheduled', color: '#d97706', icon: CalendarClock, hint: 'Change slot' },
  COMPLETED: { label: 'Completed', short: 'Completed', color: '#2563eb', icon: CheckCircle2, hint: 'Session conducted' },
  TRY_LATER: { label: 'Try Later', short: 'Try Later', color: '#4f46e5', icon: Clock, hint: 'Postponed / follow-up' },
  GHOSTED: { label: 'Ghosted', short: 'Ghosted', color: '#64748b', icon: Ghost, hint: 'No response / absent' },
  NOT_INTERESTED: { label: 'Not Interested', short: 'Not Int.', color: '#ea580c', icon: Ban, hint: 'Declined offer' },
  CANCELLED: { label: 'Cancelled', short: 'Cancelled', color: '#e11d48', icon: XCircle, hint: 'Notify student via email' },
}

export function getStatusConfig(status: string): StatusConf {
  return STATUS_CONFIG[status as BookingStatus] || { label: status || 'Unknown', short: status || 'Unknown', color: '#64748b', icon: AlertCircle, hint: '' }
}

export const tint = (color: string, pct = 12) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

export const splitSubjects = (v?: string) => (v || '').split(',').map((x) => x.trim()).filter(Boolean)
export const phoneDigits = (v?: string) => String(v || '').replace(/\D/g, '').slice(-10)
export const waLink = (phone?: string, name?: string) =>
  `https://wa.me/91${phoneDigits(phone)}?text=${encodeURIComponent(`Hi ${name || ''}, this is GenZ IITian regarding your 1:1 session.`)}`
export const mailLink = (email: string) => `mailto:${email}?subject=${encodeURIComponent('Your GenZ IITian 1:1 session')}`
export const studentNote = (b: Booking) => b.user_notes || b.notes || ''
export const isIsoDate = (v?: string) => /^\d{4}-\d{2}-\d{2}$/.test(v || '')

export function fmtDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function fmtBookedShort(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function matchesBookingSearch(b: Booking, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return true
  return (
    (b.name || '').toLowerCase().includes(q) ||
    (b.email || '').toLowerCase().includes(q) ||
    (b.phone || '').includes(q) ||
    (b.subjects || '').toLowerCase().includes(q) ||
    (b.level || '').toLowerCase().includes(q) ||
    (b.slot_date || '').toLowerCase().includes(q) ||
    studentNote(b).toLowerCase().includes(q) ||
    (b.manager_notes || '').toLowerCase().includes(q)
  )
}

/** Other bookings by the same student (matched on email or last 10 phone digits). */
export function bookingHistory(all: Booking[], b: Booking): Booking[] {
  const email = (b.email || '').toLowerCase()
  const phone = phoneDigits(b.phone)
  return all.filter((x) => x.id !== b.id && ((email && (x.email || '').toLowerCase() === email) || (phone && phoneDigits(x.phone) === phone)))
}

const API = '/api/storefront/1on1-bookings'

export async function fetchBookings(): Promise<{ bookings: Booking[]; error: string }> {
  try {
    const res = await fetch(API, { credentials: 'same-origin', cache: 'no-store' })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success) return { bookings: [], error: data?.error || `Could not load 1:1 bookings (${res.status}).` }
    return { bookings: Array.isArray(data.bookings) ? data.bookings : [], error: '' }
  } catch (err: any) {
    return { bookings: [], error: err?.message || 'Network error while loading 1:1 bookings.' }
  }
}

export type BookingAction = 'update-notes' | 'update-status' | 'reschedule' | 'cancel'

export async function postBookingAction(action: BookingAction, body: Record<string, unknown>): Promise<{ ok: boolean; error: string }> {
  try {
    const res = await fetch(`${API}/${action}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success) return { ok: false, error: data?.error || `Request failed (${res.status}).` }
    return { ok: true, error: '' }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error. Please try again.' }
  }
}
