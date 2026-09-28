import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { iitmLevel, iitmUserType, mobileNumber, instagramUrl, linkedinUrl } = await request.json()

    // 1. Validations
    const validLevels = ['Qualifier', 'Foundation', 'Diploma', 'Degree']
    const levelMatch = validLevels.find(l => l.toLowerCase() === (iitmLevel || '').toString().toLowerCase())
    if (!levelMatch) {
      return NextResponse.json({ error: 'Please select your current IITM level.' }, { status: 400 })
    }

    const validTypes = ['STANDALONE', 'DUAL DEGREE', 'WORKING PROFESSIONAL']
    const typeUpper = (iitmUserType || '').toString().toUpperCase()
    if (!validTypes.includes(typeUpper)) {
      return NextResponse.json({ error: 'Please select your IITM category.' }, { status: 400 })
    }

    const cleanMobile = (mobileNumber || '').toString().trim()
    if (!/^\d{10}$/.test(cleanMobile)) {
      return NextResponse.json({ error: 'Mobile number must be exactly 10 digits.' }, { status: 400 })
    }
    if (!/^[6789]/.test(cleanMobile)) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 })
    }

    // Optional link validations
    const cleanInsta = (instagramUrl || '').toString().trim()
    if (cleanInsta && !cleanInsta.startsWith('http://') && !cleanInsta.startsWith('https://')) {
      return NextResponse.json({ error: 'Please enter a valid Instagram URL starting with https://' }, { status: 400 })
    }

    const cleanLinkedIn = (linkedinUrl || '').toString().trim()
    if (cleanLinkedIn && !cleanLinkedIn.startsWith('http://') && !cleanLinkedIn.startsWith('https://')) {
      return NextResponse.json({ error: 'Please enter a valid LinkedIn URL starting with https://' }, { status: 400 })
    }

    // 2. Fetch current user to check if mobile number changed
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, mobileNumber: true, previousMobileNumber: true, name: true },
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    const isMobileChanged = currentUser.mobileNumber && currentUser.mobileNumber !== cleanMobile
    const previousMobileNumber = isMobileChanged
      ? currentUser.mobileNumber
      : currentUser.previousMobileNumber

    // 3. Database Update
    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: {
        iitmLevel: levelMatch,
        iitmUserType: typeUpper,
        mobileNumber: cleanMobile,
        ...(isMobileChanged ? { previousMobileNumber } : {}),
        instagramUrl: cleanInsta || null,
        linkedinUrl: cleanLinkedIn || null,
        hasUpdatedProgressSept26: true,
        progressUpdatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        mobileNumber: true,
        previousMobileNumber: true,
        iitmLevel: true,
        iitmUserType: true,
        hasUpdatedProgressSept26: true,
        progressUpdatedAt: true,
      },
    })

    // 4. Log Activity
    const mobileAuditText = isMobileChanged
      ? ` Mobile changed from ${currentUser.mobileNumber} to ${cleanMobile} (old number archived for safety).`
      : ''

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.PROFILE_UPDATED,
      actionDescription: `${session.name} updated their progress for Sept '26 Term (Level: ${levelMatch}, Category: ${typeUpper}).${mobileAuditText}`,
      moduleName: MODULE.PROFILE,
    })

    return NextResponse.json({ success: true, user: updatedUser })
  } catch (error) {
    console.error('Error in Sept 26 progress update:', error)
    return NextResponse.json({ error: 'Internal server error while saving progress.' }, { status: 500 })
  }
}
