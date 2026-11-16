import { NextRequest } from 'next/server'

/**
 * URL of the class enroll webhook. LMS_ENROLL_URL still wins when set (as in the original);
 * otherwise it is this same app's /api/external-enroll.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getEnrollUrl(_request?: NextRequest): string {
  const explicit = process.env.LMS_ENROLL_URL?.trim()
  if (explicit) return explicit
  // Never derive this from the request (Host header): the enroll secret is sent to this URL.
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') || 'https://class.genziitian.in'
  return `${origin}/api/external-enroll`
}
