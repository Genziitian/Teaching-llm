export const CAREERS_ROLES_KEY = 'careers_open_roles'

export type CareersRole = {
  id: string
  title: string
  summary: string
  tags: string[]
  comp: string
  open: boolean
}

export const DEFAULT_CAREERS_ROLES: CareersRole[] = [
  {
    id: 'tutor',
    title: 'Subject Tutor (Faculty)',
    summary: 'Teach foundation and diploma-level subjects to fellow students in Hindi, English or both.',
    tags: ['Part-time', 'Paid', 'Remote'],
    comp: '₹5,000 – ₹10,000 / month',
    open: true,
  },
  {
    id: 'campus-leader',
    title: 'Campus Leader',
    summary: 'Partner with us as the owner of an IIT Madras BS student community and grow it with real support.',
    tags: ['Part-time', 'Performance-based', 'Remote'],
    comp: 'Up to ₹5,000 / month',
    open: true,
  },
]

export function parseCareersRoles(value: unknown): CareersRole[] {
  try {
    const raw = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(raw)) return DEFAULT_CAREERS_ROLES
    const out = raw
      .filter((r) => r && typeof r === 'object' && r.id && r.title)
      .map((r: any) => ({
        id: String(r.id),
        title: String(r.title),
        summary: String(r.summary || ''),
        tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
        comp: String(r.comp || ''),
        open: r.open !== false,
      }))
    return out
  } catch {
    return DEFAULT_CAREERS_ROLES
  }
}

export const APPLICATION_STATUSES = ['PENDING', 'REVIEWED', 'SHORTLISTED', 'HIRED', 'REJECTED'] as const
