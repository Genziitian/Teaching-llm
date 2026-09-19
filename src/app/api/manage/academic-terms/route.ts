import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAcademicTerms, saveAcademicTerms } from '@/lib/academic-terms-config'

export async function GET() {
  try {
    const terms = await getAcademicTerms()
    return NextResponse.json({ success: true, terms })
  } catch (error) {
    console.error('[academic-terms API] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch academic terms' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !['MANAGER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, name, termKey, year, startDate, endDate, isCurrent, examCycles } = body

    if (!termKey || !year || !startDate || !endDate) {
      return NextResponse.json({ error: 'termKey, year, startDate, and endDate are required' }, { status: 400 })
    }

    const termId = id || `${termKey}-${year}`
    const termName = name || `${termKey === 'JAN' ? 'January' : termKey === 'MAY' ? 'May' : 'September'} ${year} Term`

    const terms = await getAcademicTerms()

    const updatedTerm = {
      id: termId,
      name: termName,
      termKey,
      year: Number(year),
      startDate,
      endDate,
      isCurrent: Boolean(isCurrent),
      examCycles: examCycles || {
        QUIZ_1: { startDate: '', endDate: '' },
        QUIZ_2: { startDate: '', endDate: '' },
        END_TERM: { startDate: '', endDate: '' },
      },
    }

    if (isCurrent) {
      terms.forEach((t: any) => { t.isCurrent = false })
    }

    const existingIndex = terms.findIndex((t: any) => t.id === termId)
    if (existingIndex >= 0) {
      terms[existingIndex] = updatedTerm
    } else {
      terms.push(updatedTerm)
    }

    const saved = await saveAcademicTerms(terms)
    return NextResponse.json({ success: true, term: updatedTerm, terms: saved })
  } catch (error) {
    console.error('[academic-terms API] POST error:', error)
    return NextResponse.json({ error: 'Failed to save academic term' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !['MANAGER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const termId = searchParams.get('id')

    if (!termId) {
      return NextResponse.json({ error: 'Term ID is required' }, { status: 400 })
    }

    const terms = (await getAcademicTerms()).filter((t: any) => t.id !== termId)
    const saved = await saveAcademicTerms(terms)

    return NextResponse.json({ success: true, terms: saved })
  } catch (error) {
    console.error('[academic-terms API] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete academic term' }, { status: 500 })
  }
}
