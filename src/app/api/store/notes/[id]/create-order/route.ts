import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import Razorpay from 'razorpay'
import { getSession } from '@/lib/auth'
import { accessState, addDays } from '@/lib/store-notes'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const session = await getSession()
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.email }
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const note = await prisma.storeNote.findUnique({
      where: { id: params.id }
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Active access blocks a second purchase; an expired one can be restored.
    const existingAccess = await prisma.storeNoteAccess.findFirst({
      where: { noteId: note.id, userId: user.id }
    })

    if (existingAccess && accessState(existingAccess, note.validityDays) === 'ACTIVE') {
      return NextResponse.json({ error: 'You already have active access to this note.' }, { status: 400 })
    }

    const price = note.price

    if (price === 0) {
      const expiresAt = addDays(new Date(), note.validityDays)
      await prisma.storeNoteAccess.upsert({
        where: { noteId_userId: { noteId: note.id, userId: user.id } },
        create: { noteId: note.id, userId: user.id, expiresAt },
        update: { createdAt: new Date(), expiresAt },
      })
      return NextResponse.json({ isFree: true })
    }

    // Create Razorpay Order
    const options = {
      amount: Math.round(price * 100),
      currency: 'INR',
      receipt: `note_${user.id.slice(0, 8)}_${Date.now()}`,
    }

    const order = await razorpay.orders.create(options)
    // The key id is public (not the secret); fall back to the server one if the public var is missing.
    const publicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID

    return NextResponse.json({
      razorpayOrderId: order.id,
      amount: options.amount,
      key: publicKeyId,
      keyId: publicKeyId,
      currency: 'INR',
      noteTitle: note.title,
      userName: user.name || '',
      userEmail: user.email || '',
    })
  } catch (error: any) {
    console.error('Error creating note order:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
