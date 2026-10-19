import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { canManageNotes, isStaffRole, readFileInputs, serializeNote } from '@/lib/store-notes'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    const isStaff = isStaffRole(session?.role)
    const note = await prisma.storeNote.findUnique({
      where: { id: params.id },
      include: { files: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!note || (!note.isActive && !isStaff)) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }
    const access = session?.userId
      ? await prisma.storeNoteAccess.findUnique({
          where: { noteId_userId: { noteId: note.id, userId: session.userId } },
        })
      : null
    return NextResponse.json({ note: serializeNote(note, { access, isStaff }) })
  } catch (error: any) {
    console.error('Error fetching note:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session?.userId || !canManageNotes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = params

    await prisma.storeNoteFile.deleteMany({ where: { noteId: id } })
    await prisma.storeNote.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting note:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session?.userId || !canManageNotes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = params
    const body = await req.json()
    const { title, description, price, category, subject, validityDays, highlights, extraRules, isActive } = body
    const fileInputs = readFileInputs(body)

    const days = Math.round(Number(validityDays))

    const updated = await prisma.storeNote.update({
      where: { id },
      data: {
        title,
        description,
        price: Number(price),
        category: category || undefined,
        subject: subject !== undefined ? subject : undefined,
        validityDays: Number.isFinite(days) && days >= 1 && days <= 3650 ? days : undefined,
        highlights: highlights !== undefined ? (String(highlights) || null) : undefined,
        extraRules: extraRules !== undefined ? (String(extraRules) || null) : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
      }
    })

    // The submitted list is the full set of files for this note.
    if (fileInputs.length > 0) {
      await prisma.storeNoteFile.deleteMany({ where: { noteId: id } })
      await prisma.storeNoteFile.createMany({
        data: fileInputs.map((f, i) => ({
          noteId: id,
          title: f.title || 'Document',
          fileUrl: f.fileUrl,
          fileType: 'LINK',
          sortOrder: i,
        })),
      })
    }

    return NextResponse.json({ note: updated })
  } catch (error: any) {
    console.error('Error updating note:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
