import { NextRequest, NextResponse } from 'next/server'

/** Parse a JSON body; the original Vercel handlers used `req.body || {}`. */
export async function readBody(request: NextRequest): Promise<any> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}

/** Escape LIKE wildcards so an email can be matched case-insensitively with ilike. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** Minimal Express-style `res` so the ported handlers keep their original `res.status(n).json(x)` returns. */
export function jsonRes(noStore = false) {
  return {
    status: (code: number) => ({
      json: (body: any) =>
        NextResponse.json(body, { status: code, headers: noStore ? { 'Cache-Control': 'no-store' } : undefined }),
    }),
  }
}
