import { NextRequest } from 'next/server'

/**
 * URL of the class enroll webhook. LMS_ENROLL_URL still wins when set (as in the original);
 * otherwise it is this same app's /api/external-enroll.
 */
export function getEnrollUrl(request: NextRequest): string {
  const explicit = process.env.LMS_ENROLL_URL?.trim()
  if (explicit) return explicit
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') ||
    request.nextUrl?.origin ||
    'https://class.genziitian.in'
  return `${origin}/api/external-enroll`
}
