import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { addDays } from '@/lib/store-notes'
import { logActivity, MODULE, ACTION } from '@/lib/activity-log'
import { sendEmailNotification } from '@/lib/email-service'
import { verifyPlayPurchase } from '@/lib/google-play'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.email },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { purchaseToken, productId, orderId: clientOrderId } = await req.json()

    if (!purchaseToken || !productId) {
      return NextResponse.json(
        { error: 'Missing purchaseToken or productId' },
        { status: 400 }
      )
    }

    const note = await prisma.storeNote.findUnique({
      where: { id: params.id },
    })
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Verify expected tier (e.g. note with price ₹49 expects note_49)
    const expectedTier = `note_${Math.round(note.price)}`
    if (productId !== expectedTier) {
      console.warn(`Product ID mismatch: received ${productId}, expected ${expectedTier}`)
    }

    // Call Google Play API to verify purchase
    const playData = await verifyPlayPurchase({
      productId,
      token: purchaseToken,
    })

    // purchaseState: 0 = Purchased, 1 = Canceled, 2 = Pending
    if (playData.purchaseState !== 0) {
      return NextResponse.json(
        { error: 'Purchase is not in a completed state on Google Play' },
        { status: 400 }
      )
    }

    const finalOrderId = playData.orderId || clientOrderId || `play_${Date.now()}`

    // Grant (or restore) access with fresh validity from today
    const expiresAt = addDays(new Date(), note.validityDays)
    const access = await prisma.storeNoteAccess.upsert({
      where: { noteId_userId: { noteId: params.id, userId: user.id } },
      create: {
        noteId: params.id,
        userId: user.id,
        orderId: finalOrderId,
        expiresAt,
      },
      update: {
        orderId: finalOrderId,
        createdAt: new Date(),
        expiresAt,
      },
      include: { note: true },
    })

    // Log the purchase
    logActivity({
      userId: user.id,
      userName: user.name || user.email || 'User',
      userRole: user.role,
      actionType: ACTION.PURCHASE_COMPLETED,
      actionDescription: `Purchased study note via Google Play: ${access.note.title} for ₹${access.note.price}`,
      moduleName: MODULE.STORE,
      targetId: access.id,
      metadata: {
        itemType: 'STUDY_NOTE',
        itemId: params.id,
        amount: access.note.price,
        googlePlayOrderId: finalOrderId,
        productId,
      },
    })

    // Trigger purchase confirmation email
    sendEmailNotification('purchase', {
      userEmail: user.email,
      userName: user.name,
      orderId: finalOrderId,
      itemType: 'NOTE',
      itemName: access.note.title,
      amount: access.note.price,
      date: new Date().toLocaleDateString(),
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/purchased`,
    }).catch(console.error)

    return NextResponse.json({
      success: true,
      expiresAt,
      message: 'Purchase verified successfully',
    })
  } catch (error: any) {
    console.error('Google Play purchase verification error:', error)
    return NextResponse.json(
      { error: error.message || 'Verification failed' },
      { status: 500 }
    )
  }
}
