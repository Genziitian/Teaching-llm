import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { canManageNotes, isStaffRole, readFileInputs, serializeNote } from '@/lib/store-notes'

function cleanDays(v: any) {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 1 && n <= 3650 ? n : 90
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session?.userId || !canManageNotes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const data = await req.json()
    const { title, description, price, category, subject, validityDays, highlights, extraRules } = data
    const fileInputs = readFileInputs(data)

    if (!title || fileInputs.length === 0) {
      return NextResponse.json({ error: 'Title and at least one file are required' }, { status: 400 })
    }

    const note = await prisma.storeNote.create({
      data: {
        title,
        description,
        price: Number(price) || 0,
        createdById: session.userId,
        category: category || 'General',
        subject: subject || null,
        validityDays: cleanDays(validityDays),
        highlights: highlights ? String(highlights) : null,
        extraRules: extraRules ? String(extraRules) : null,
        files: {
          create: fileInputs.map((f, i) => ({
            title: f.title || 'Document',
            fileUrl: f.fileUrl,
            fileType: 'LINK',
            sortOrder: i,
          }))
        }
      }
    })

    return NextResponse.json({ note })
  } catch (error: any) {
    console.error('Error creating store note:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getSession()
    const isStaff = isStaffRole(session?.role)
    const notes = await prisma.storeNote.findMany({
      where: isStaff ? undefined : { isActive: true },
      include: { files: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    })

    const accesses = session?.userId
      ? await prisma.storeNoteAccess.findMany({ where: { userId: session.userId } })
      : []
    const byNote = new Map(accesses.map((a) => [a.noteId, a]))

    return NextResponse.json({
      notes: notes.map((n) => serializeNote(n, { access: byNote.get(n.id) ?? null, isStaff })),
    })
  } catch (error: any) {
    console.error('Error fetching store notes:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
