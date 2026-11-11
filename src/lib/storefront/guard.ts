import { NextResponse } from 'next/server'
import { getSession, type JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { StorefrontNotConfiguredError } from './db'

export type Guard = { session: JWTPayload } | { response: NextResponse }

/**
 * TEST SWITCH (off by default): STOREFRONT_PANEL_OPEN_TO_ALL=true lets ANY signed-in user use the
 * storefront panel APIs. Never leave this on for a live site that points at real customer data.
 * Employee ID/birth-date tables stay super-manager only (see requireSuperManager).
 */
export function isPanelOpenToAll(): boolean {
  return process.env.STOREFRONT_PANEL_OPEN_TO_ALL?.trim() === 'true'
}

/** Managers only (or any signed-in user while the test switch above is on). Use: const g = await requireManager(); if ('response' in g) return g.response */
export async function requireManager(): Promise<Guard> {
  const session = await getSession()
  if (!session || (session.role !== 'MANAGER' && !isPanelOpenToAll())) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session }
}

/** Super-managers only (for sensitive data such as employee ID numbers). */
export async function requireSuperManager(): Promise<Guard> {
  const g = await requireManager()
  if ('response' in g) return g
  const user = await prisma.user.findUnique({ where: { id: g.session.userId }, select: { isSuperManager: true } })
  if (!user?.isSuperManager) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return g
}

export function storefrontError(scope: string, error: unknown): NextResponse {
  if (error instanceof StorefrontNotConfiguredError) {
    return NextResponse.json({ error: error.message, code: 'STOREFRONT_NOT_CONFIGURED' }, { status: 503 })
  }
  console.error(`[storefront:${scope}]`, error)
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
}
