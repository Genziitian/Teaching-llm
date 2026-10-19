import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { accessExpiry, accessState } from '@/lib/store-notes'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.email) {
      return NextResponse.json({ materials: [] })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.email }
    })

    if (!user) return NextResponse.json({ materials: [] })

    const accesses = await prisma.storeNoteAccess.findMany({
      where: { userId: user.id },
      include: { note: { include: { files: true } } },
      orderBy: { createdAt: 'desc' }
    })

    // Only active purchases are listed here; expired ones are restored from the Store.
    const purchasedMaterials = accesses
      .filter(acc => accessState(acc, acc.note.validityDays) === 'ACTIVE')
      .map(acc => ({
        id: acc.id,
        noteId: acc.note.id,
        title: acc.note.title,
        description: acc.note.description,
        fileUrl: '', // client requests the file via the download endpoint
        purchasedAt: acc.createdAt,
        expiresAt: accessExpiry(acc, acc.note.validityDays)
      }))

    return NextResponse.json({ materials: purchasedMaterials })
  } catch (error: any) {
    console.error('Error fetching purchased materials:', error)
    return NextResponse.json({ materials: [] })
  }
}
