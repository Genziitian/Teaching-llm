/**
 * Sidebar menu visibility: shared constants (safe to import from client code).
 * A manager can hide or show any of these for students and other roles; managers
 * themselves always see every item (hidden ones are marked).
 */
export interface MenuEntry {
  href: string
  label: string
  group: string
}

export const MENU_REGISTRY: MenuEntry[] = [
  { href: '/courses', label: 'Courses', group: 'Learn' },
  { href: '/live', label: 'Live Sessions', group: 'Learn' },
  { href: '/calendar', label: 'Calendar', group: 'Learn' },
  { href: '/free-resources', label: 'Free Resources', group: 'Learn' },
  { href: '/materials', label: 'Study Materials', group: 'Learn' },
  { href: '/courses/explore', label: 'Store', group: 'Explore' },
  { href: 'https://quiz.genziitian.in/', label: 'Quiz Lab', group: 'Explore' },
  { href: '/exam-protection', label: 'Exam Protection', group: 'Explore' },
  { href: '/community', label: 'Community', group: 'Connect' },
  { href: '/announcements', label: 'Announcements', group: 'Connect' },
  { href: '/support', label: 'Support', group: 'Connect' },
  { href: '/feedback', label: 'Feedback', group: 'Connect' },
  { href: '/manage/queries', label: 'Queries', group: 'Manage' },
  { href: '/manage/notifications', label: 'Notifications', group: 'Manage' },
  { href: '/manage/updates', label: 'Updates', group: 'Manage' },
  { href: '/manage/prompts', label: 'User Prompts', group: 'Manage' },
  { href: '/manage/facts', label: 'Loading Facts', group: 'Manage' },
  { href: '/manage/coupons', label: 'Coupons', group: 'Manage' },
  { href: '/manage/mail-assigner', label: 'Mail Assigner', group: 'Manage' },
  { href: '/admin', label: 'User Admin', group: 'Admin' },
  { href: '/transactions', label: 'Transactions', group: 'Admin' },
  { href: '/activity-logs', label: 'Activity Log', group: 'Admin' },
  { href: '/data-analysis', label: 'Data Analysis', group: 'Admin' },
  { href: '/google-sync', label: 'Google Sync', group: 'Admin' },
  { href: '/company/about-us', label: 'About Us', group: 'Company' },
]

/** Never hideable: Home, Manage, and this settings page, so nobody can lock themselves out. */
export const LOCKED_MENUS = ['/dashboard', '/manage', '/manage/menus']

/** Hidden until a manager saves a list for the first time. */
export const DEFAULT_HIDDEN_MENUS = ['/exam-protection']

export function sanitizeHidden(list: unknown): string[] {
  if (!Array.isArray(list)) return DEFAULT_HIDDEN_MENUS
  const allowed = new Set(MENU_REGISTRY.map(m => m.href))
  return Array.from(new Set(list.filter((h): h is string => typeof h === 'string' && allowed.has(h) && !LOCKED_MENUS.includes(h))))
}
