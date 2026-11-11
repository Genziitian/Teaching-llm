import { prisma } from '@/lib/db'
import { DEFAULT_HIDDEN_MENUS, sanitizeHidden } from '@/lib/menu-visibility-config'

/**
 * Hidden sidebar items. `hiddenMenus` is a comma-separated list on AppFlags; NULL means
 * "never configured" and falls back to the default (Exam Protection hidden). Also falls
 * back to the default if the column doesn't exist yet, so nothing breaks before the SQL runs.
 */
export async function getHiddenMenus(): Promise<string[]> {
  try {
    const row = await (prisma as any).appFlags.findUnique({ where: { id: 'singleton' } })
    const raw = row?.hiddenMenus
    if (raw === null || raw === undefined) return DEFAULT_HIDDEN_MENUS
    return sanitizeHidden(String(raw).split(',').filter(Boolean))
  } catch {
    return DEFAULT_HIDDEN_MENUS
  }
}

export async function setHiddenMenus(list: string[]): Promise<string[]> {
  const clean = sanitizeHidden(list)
  await (prisma as any).appFlags.upsert({
    where: { id: 'singleton' },
    update: { hiddenMenus: clean.join(',') },
    create: { id: 'singleton', hiddenMenus: clean.join(',') },
  })
  return clean
}
