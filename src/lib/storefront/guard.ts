import { NextResponse } from 'next/server'
import { getSession, type JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { StorefrontNotConfiguredError } from './db'

export type Guard = { session: JWTPayload } | { response: NextResponse }

/** Managers only. Use: const g = await requireManager(); if ('response' in g) return g.response */
export async function requireManager(): Promise<Guard> {
  const session = await getSession()
  if (!session || session.role !== 'MANAGER') {
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
