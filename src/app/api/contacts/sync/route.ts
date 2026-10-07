import { NextResponse } from 'next/server'

/**
 * Contact sync has been discontinued.
 *
 * App versions released before the removal may still call this endpoint with a
 * student's phone contacts. The request body is never read and nothing is
 * stored; the endpoint only answers "success" so those old app versions carry
 * on normally.
 */
export async function POST() {
  return NextResponse.json({
    success: true,
    count: 0,
    message: 'Contact sync has been discontinued',
  })
}
