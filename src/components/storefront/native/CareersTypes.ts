export const CAREERS_ROLES_KEY = 'careers_open_roles'

export type CareersRole = {
  id: string
  title: string
  summary: string
  tags: string[]
  comp: string
  open: boolean
  // Optional extras (stored in the same JSON, older roles simply lack them)
  type?: string
  mode?: string
  pay?: string
  location?: string
  experience?: string
  openings?: number
  deadline?: string
  skills?: string[]
}

export const ROLE_TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Volunteer']
export const ROLE_MODES = ['Remote', 'Hybrid', 'On-site']
export const ROLE_PAY = ['Paid', 'Unpaid', 'Performance-based']

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
        type: r.type ? String(r.type) : undefined,
        mode: r.mode ? String(r.mode) : undefined,
        pay: r.pay ? String(r.pay) : undefined,
        location: r.location ? String(r.location) : undefined,
        experience: r.experience ? String(r.experience) : undefined,
        openings: Number(r.openings) > 0 ? Number(r.openings) : undefined,
        deadline: r.deadline ? String(r.deadline) : undefined,
        skills: Array.isArray(r.skills) ? r.skills.map(String).filter(Boolean) : undefined,
      }))
    return out
  } catch {
    return DEFAULT_CAREERS_ROLES
  }
}

export const APPLICATION_STATUSES = ['PENDING', 'REVIEWED', 'SHORTLISTED', 'HIRED', 'REJECTED'] as const
