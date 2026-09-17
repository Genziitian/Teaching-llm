import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Demo trial payment verification has been deprecated.' }, { status: 410 })
}

