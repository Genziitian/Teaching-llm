import { getSession } from '@/lib/auth'

export const SITE_HOST = 'class.genziitian.in'

export function isStaffRole(role?: string | null) {
  return role === 'MANAGER' || role === 'ADMIN' || role === 'MODERATOR'
}

/** Only these roles may create / edit / delete store notes. */
export function canManageNotes(role?: string | null) {
  return role === 'MANAGER' || role === 'ADMIN'
}

export function splitLines(text?: string | null): string[] {
  return (text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-\u2022*]+/, '').trim())
    .filter(Boolean)
}

/**
 * The rules shown on a note's Details page. Built here ONCE so the website
 * and the app always show exactly the same text. Admin-written extra rules
 * are appended after the standard ones.
 */
export function buildNoteRules(validityDays: number, extraRules?: string | null): string[] {
  const days = Math.max(1, Math.round(validityDays || 90))
  return [
    `You can use this for ${days} days, starting from your purchase date.`,
    `You can access it anywhere \u2014 on the website (${SITE_HOST}) and in the app too.`,
    'You can download it anywhere, on the app or on the website.',
    'When access expires, the paper is removed from your downloads and shown as Expired.',
    'You can restore an expired paper any time by paying again \u2014 a fresh validity period starts from the new purchase date.',
    'This is for your personal use only. Sharing or reselling it is not allowed.',
    'By buying, you accept our Terms & Conditions and our Refund / Return Policy.',
    ...splitLines(extraRules),
  ]
}

export function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
}

type AccessLike = { createdAt: Date; expiresAt: Date | null }

export function accessExpiry(access: AccessLike, validityDays: number) {
  return access.expiresAt ?? addDays(access.createdAt, validityDays || 90)
}

export type AccessState = 'NONE' | 'ACTIVE' | 'EXPIRED'

export function accessState(access: AccessLike | null | undefined, validityDays: number): AccessState {
  if (!access) return 'NONE'
  return accessExpiry(access, validityDays).getTime() > Date.now() ? 'ACTIVE' : 'EXPIRED'
}

/** Public JSON shape of a note. File URLs are included only when allowed. */
export function serializeNote(note: any, opts: { access?: AccessLike | null; isStaff: boolean }) {
  const validityDays = note.validityDays || 90
  const state = accessState(opts.access, validityDays)
  const free = (note.price ?? 0) === 0
  const canOpen = opts.isStaff || free || state === 'ACTIVE'
  return {
    id: note.id,
    title: note.title,
    description: note.description,
    price: note.price,
    originalPrice: note.originalPrice,
    thumbnailUrl: note.thumbnailUrl,
    category: note.category,
    subject: note.subject,
    isActive: note.isActive,
    createdAt: note.createdAt,
    validityDays,
    highlights: splitLines(note.highlights),
    highlightsRaw: opts.isStaff ? note.highlights || '' : undefined,
    extraRulesRaw: opts.isStaff ? note.extraRules || '' : undefined,
    rules: buildNoteRules(validityDays, note.extraRules),
    files: (note.files || []).map((f: any) => ({
      ...f,
      fileUrl: canOpen ? f.fileUrl : '',
    })),
    myAccess: opts.access
      ? {
          state,
          purchasedAt: opts.access.createdAt,
          expiresAt: accessExpiry(opts.access, validityDays),
        }
      : null,
    hasAccess: canOpen,
  }
}

export async function currentUserId() {
  const session = await getSession()
  return { session, userId: session?.userId as string | undefined }
}

export type NoteFileInput = { title?: string; fileUrl: string }

/** Accepts `files: [{title,fileUrl}]` (preferred) or a single `fileUrl`. */
export function readFileInputs(body: any): NoteFileInput[] {
  const raw: any[] = Array.isArray(body?.files)
    ? body.files
    : body?.fileUrl
      ? [{ title: 'Primary Document', fileUrl: body.fileUrl }]
      : []
  return raw
    .filter((f) => f && typeof f.fileUrl === 'string' && f.fileUrl.trim())
    .map((f) => ({ title: String(f.title || '').trim() || 'Document', fileUrl: f.fileUrl.trim() }))
}
