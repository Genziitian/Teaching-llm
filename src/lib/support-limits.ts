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
