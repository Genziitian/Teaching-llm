export const NOTE_MIMES = ['application/pdf', 'application/vnd.google-apps.document', 'application/vnd.google-apps.presentation']
export function meetCode(value: string | null | undefined): string | null {
  if (!value) return null
  const raw = value.trim().toLowerCase()
  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(raw)) return raw
  try {
    const url = new URL(raw)
    return url.hostname === 'meet.google.com' ? url.pathname.match(/^\/([a-z]{3}-[a-z]{4}-[a-z]{3})\/?$/)?.[1] || null : null
  } catch { return null }
}
export function notesKey(date: Date): string {
  return new Date(date.getTime() + 330 * 60000).toISOString().slice(0, 16).replace('T', '_').replace(':', '')
}
export function parseNotesName(name: string): string | null {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})_.+/)
  if (!match) return null
  const date = new Date(`${match[1]}T${match[2]}:${match[3]}:00+05:30`)
  const key = `${match[1]}_${match[2]}${match[3]}`
  return Number.isFinite(date.getTime()) && notesKey(date) === key ? key : null
}
export type Occurrence = { id: string; courseId: string | null; title: string; startTime: Date; endTime: Date; meetLink: string | null }
export function matchRecording(recording: { meetCode: string; startTime: Date; endTime: Date | null }, events: Occurrence[]) {
  if (!recording.endTime) return []
  return events.filter(e => meetCode(e.meetLink) === recording.meetCode && e.startTime < recording.endTime! && e.endTime > recording.startTime)
}
export function lectureTitle(title: string, start: Date, part?: number) {
  return `${title} — ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(start)}${part ? ` — Part ${part}` : ''}`
}
export function discoveryStart(activation: Date, watermark: Date | null, now: Date) {
  return new Date(Math.max(activation.getTime(), Math.min(now.getTime() - 7 * 86400000, watermark?.getTime() ?? now.getTime())))
}
export function fieldsUnchanged(current: Record<string, unknown>, previous: Record<string, unknown>) {
  return Object.entries(previous).every(([key, value]) => current[key] === value)
}
