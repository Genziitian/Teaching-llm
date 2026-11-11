// Shared helpers for the manager 1:1 bookings routes (ported from genziitian server/index.js).
// The original kept an in-memory/file cache of bookings; serverless has no durable disk, so the
// one_on_one_bookings table plus the activity_logs ledger are the sources of truth here.
import type { SupabaseClient } from '@supabase/supabase-js'

export type Booking = Record<string, any>

export const BOOKING_LOG_ACTIONS = ['1ON1_SLOT_BOOKED', '1ON1_SLOT_CANCELLED', '1ON1_SLOT_RESCHEDULED', '1ON1_STATUS_UPDATED']

/** Replays 1:1 booking events from activity_logs into booking objects (same rules as the original GET). */
export async function loadLogBookings(db: SupabaseClient, studentEmail?: string | null): Promise<Booking[]> {
  let q = db.from('activity_logs').select('*').in('action', BOOKING_LOG_ACTIONS).order('created_at', { ascending: true })
  if (studentEmail) q = q.eq('email', studentEmail)
  const { data: logs, error } = await q
  if (error || !Array.isArray(logs)) return []
  const logMap = new Map<string, Booking>()
  for (const log of logs) {
    const meta = log.metadata || {}
    const bId = meta.id || `log-${log.id}`
    if (log.action === '1ON1_SLOT_BOOKED') {
      logMap.set(bId, {
        id: bId,
        name: meta.name || 'Student',
        email: (log.email || meta.email || '').trim().toLowerCase(),
        phone: meta.phone || '',
        level: meta.level || 'Foundation Level',
        subjects: meta.subjects || 'General',
        slot_date: meta.slot_date || 'Upcoming',
        slot_time: meta.slot_time || '15-min consultation',
        plan: meta.plan || '1:1 Personalised Teaching',
        notes: meta.notes || meta.user_notes || '',
        user_notes: meta.user_notes || meta.notes || '',
        manager_notes: meta.manager_notes || '',
        status: meta.status || 'CONFIRMED',
        created_at: meta.created_at || log.created_at || new Date().toISOString(),
        updated_at: meta.updated_at || log.created_at || new Date().toISOString(),
      })
    } else if (log.action === '1ON1_SLOT_CANCELLED' && logMap.has(bId)) {
      const b = logMap.get(bId)!
      b.status = 'CANCELLED'
      if (meta.manager_notes || meta.reason) b.manager_notes = meta.manager_notes || meta.reason
      b.updated_at = log.created_at
    } else if (log.action === '1ON1_SLOT_RESCHEDULED' && logMap.has(bId)) {
      const b = logMap.get(bId)!
      b.status = 'RESCHEDULED'
      if (meta.new_slot_date) b.slot_date = meta.new_slot_date
      if (meta.new_slot_time) b.slot_time = meta.new_slot_time
      if (meta.manager_notes || meta.reason) b.manager_notes = meta.manager_notes || meta.reason
      b.updated_at = log.created_at
    } else if (log.action === '1ON1_STATUS_UPDATED' && logMap.has(bId)) {
      const b = logMap.get(bId)!
      if (meta.status) b.status = meta.status
      if (meta.manager_notes !== undefined) b.manager_notes = meta.manager_notes
      b.updated_at = log.created_at
    }
  }
  return Array.from(logMap.values())
}

/**
 * Finds one booking: table row first (original behaviour), else the ledger replay.
 * The ledger fallback replaces the original in-memory cache lookup.
 */
export async function findBooking(db: SupabaseClient, id: string): Promise<{ booking?: Booking; row?: Booking }> {
  const { data } = await db.from('one_on_one_bookings').select('*').eq('id', id).maybeSingle()
  if (data) return { booking: { ...data }, row: data }
  const fromLogs = (await loadLogBookings(db)).find((b) => b.id === id)
  return { booking: fromLogs }
}

/**
 * Sends the email request to the Google Apps Script webhook (same env var chain, payload and
 * BCC as the original). Never throws; never logs personal data.
 */
export async function dispatch1on1Webhook(payload: Record<string, any>): Promise<void> {
  const webhookUrl =
    process.env.ONE_ON_ONE_WEBHOOK_URL ||
    process.env.VITE_ONE_ON_ONE_WEBHOOK_URL ||
    process.env.ONE_TO_ONE_WEBHOOK_URL ||
    process.env.VITE_ONE_TO_ONE_WEBHOOK_URL ||
    process.env.ONE_ON_ONE_APP_SCRIPT_URL ||
    process.env.WELCOME_WEBHOOK_URL ||
    process.env.GOOGLE_SHEET_WEBHOOK_URL ||
    process.env.APP_SCRIPT_URL
  if (!webhookUrl) {
    console.warn('[storefront:1on1] No webhook URL configured; email not sent')
    return
  }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        ...payload,
        bcc: 'genziitian@gmail.com, lkiitmng2428@gmail.com',
        timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
      }),
    })
    const text = await res.text()
    if (text.includes('<!DOCTYPE html>') || text.includes('ppConfig') || text.includes('accounts.google.com')) {
      console.error('[storefront:1on1] Apps Script returned a Google login page: set the web app access to "Anyone".')
    }
  } catch (err) {
    console.error('[storefront:1on1] Webhook dispatch failed:', (err as Error).message)
  }
}

export async function readBody(request: Request): Promise<Record<string, any>> {
  try {
    const b = await request.json()
    return b && typeof b === 'object' ? b : {}
  } catch {
    return {}
  }
}

/**
 * Updates the one_on_one_bookings row. The original wrote updated_at (a column the shipped SQL does
 * not create) and ignored the resulting error, so updates were silently lost; this retries without
 * updated_at when the first attempt fails. Errors are swallowed like the original.
 */
export async function updateBookingRow(db: SupabaseClient, id: string, fields: Record<string, any>): Promise<void> {
  try {
    const { error } = await db.from('one_on_one_bookings').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) await db.from('one_on_one_bookings').update(fields).eq('id', id)
  } catch {}
}
