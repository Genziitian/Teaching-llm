// Shared support-ticket limits (safe to import from client and server code).
export const MAX_ACTIVE_TICKETS = 5
export const TICKET_AUTO_CLOSE_DAYS = 3

// Ticket number shown to people. New tickets have a real serial (ticketNumber);
// older ones keep their legacy number derived from the id.
export function ticketNo(t: { id: string; ticketNumber?: number | null }): string {
  if (t.ticketNumber != null) return String(t.ticketNumber)
  const hash = t.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return String(8000 + (hash % 2000))
}

// How long a call rings before it counts as missed (server expiry + client countdown).
export const RING_SECONDS = 60

// Support team hours (IST). Live calls only ring inside them; outside, GenZie offers a call back or a ticket.
export const SUPPORT_OPEN_HOUR = 10
export const SUPPORT_CLOSE_HOUR = 22
export function isSupportOpen(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60000) // UTC+5:30, no DST
  const h = ist.getUTCHours() + ist.getUTCMinutes() / 60
  return h >= SUPPORT_OPEN_HOUR && h < SUPPORT_CLOSE_HOUR
}
