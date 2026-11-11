import { NextResponse } from 'next/server'
import { getFullSession } from '@/lib/auth'
import { getLiveTree } from '@/lib/genie/store'

export const dynamic = 'force-dynamic'

// The question/answer tree the Genie box walks (database content, built-in as a fallback).
export async function GET() {
  const session = await getFullSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { tree, source } = await getLiveTree()
  return NextResponse.json({ tree, source })
}
