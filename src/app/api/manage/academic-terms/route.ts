import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), 'src', 'data', 'academic-terms-config.json')

function readConfig(): { terms: any[] } {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error('[academic-terms API] Failed to read config:', e)
  }
  return { terms: [] }
}

function writeConfig(data: { terms: any[] }) {
  try {
    const dir = path.dirname(CONFIG_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) {
    console.error('[academic-terms API] Failed to write config:', e)
  }
}

export async function GET() {
  try {
    const config = readConfig()
    return NextResponse.json({ success: true, terms: config.terms || [] })
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

    const config = readConfig()
    const terms = config.terms || []

    const existingIndex = terms.findIndex((t: any) => t.id === termId)
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
      // Unset other current flags
      terms.forEach((t: any) => { t.isCurrent = false })
    }

    if (existingIndex >= 0) {
      terms[existingIndex] = updatedTerm
    } else {
      terms.push(updatedTerm)
    }

    // Sort terms chronologically
    terms.sort((a: any, b: any) => {
      if (a.year !== b.year) return a.year - b.year
      const order = ['JAN', 'MAY', 'SEP']
      return order.indexOf(a.termKey) - order.indexOf(b.termKey)
    })

    writeConfig({ terms })

    return NextResponse.json({ success: true, term: updatedTerm, terms })
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

    const config = readConfig()
    const terms = (config.terms || []).filter((t: any) => t.id !== termId)
    writeConfig({ terms })

    return NextResponse.json({ success: true, terms })
  } catch (error) {
    console.error('[academic-terms API] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete academic term' }, { status: 500 })
  }
}
