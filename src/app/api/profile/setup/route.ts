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

    const { firstName, lastName, mobileNumber, gender, age, state, avatar } = await request.json()

    // 1. Strict Validations
    if (!firstName || !lastName || !firstName.trim() || !lastName.trim()) {
      return NextResponse.json({ error: 'First name and last name are required.' }, { status: 400 })
    }
    
    if (!mobileNumber || !/^\d{10}$/.test(mobileNumber)) {
      return NextResponse.json({ error: 'Mobile number must be exactly 10 digits.' }, { status: 400 })
    }

    if (!gender || !['MALE', 'FEMALE', 'OTHER'].includes(gender.toUpperCase())) {
      return NextResponse.json({ error: 'Gender must be selected (Male, Female, or Other).' }, { status: 400 })
    }

    const ageInt = parseInt(age, 10)
    if (!age || isNaN(ageInt) || ageInt < 1 || ageInt > 120) {
      return NextResponse.json({ error: 'Please enter a valid age.' }, { status: 400 })
    }

    if (!state || !state.trim()) {
      return NextResponse.json({ error: 'State is required.' }, { status: 400 })
    }

    const name = `${firstName.trim()} ${lastName.trim()}`

    // 2. Database Update
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: {
        name,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobileNumber,
        gender: gender.toUpperCase(),
        genderChangedAt: new Date(),
        age: ageInt,
        state: state.trim(),
        isProfileComplete: true,
        ...(avatar !== undefined ? { avatar } : {}),
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        isProfileComplete: true,
      },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.PROFILE_UPDATED,
      actionDescription: `${session.name} completed their profile setup.`,
      moduleName: MODULE.PROFILE,
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('Error in profile setup:', error)
    return NextResponse.json({ error: 'Internal server error while saving profile.' }, { status: 500 })
  }
}
