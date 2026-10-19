import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { accessExpiry, accessState } from '@/lib/store-notes'

/** Every note the signed-in user has bought, including expired ones. */
export async function GET() {
  try {
    const session = await getSession()
    if (!session?.userId) return NextResponse.json({ notes: [] })

    const accesses = await prisma.storeNoteAccess.findMany({
      where: { userId: session.userId },
      include: { note: { select: { id: true, title: true, subject: true, category: true, price: true, validityDays: true, isActive: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      notes: accesses.map((a) => ({
        noteId: a.noteId,
        title: a.note.title,
        subject: a.note.subject,
        category: a.note.category,
        price: a.note.price,
        state: accessState(a, a.note.validityDays),
        purchasedAt: a.createdAt,
        expiresAt: accessExpiry(a, a.note.validityDays),
      })),
    })
  } catch (error: any) {
    console.error('Error fetching my notes:', error)
    return NextResponse.json({ notes: [] })
  }
}
