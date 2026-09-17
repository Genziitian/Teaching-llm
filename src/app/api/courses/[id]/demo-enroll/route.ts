import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Demo trial enrollment has been deprecated.' }, { status: 410 })
}

