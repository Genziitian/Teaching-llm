import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { NAME_DIGIT_ERROR, nameHasDigit } from '@/lib/name-validation'
import { getSession } from '@/lib/auth'
import { logActivity, ACTION, MODULE } from '@/lib/activity-log'
import { ABOUT_ME_MAX_WORDS, countWords } from '@/lib/profile-limits'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        mobileNumber: true,
        email: true,
        role: true,
        avatar: true,
        gender: true,
        genderChangedAt: true,
        age: true,
        state: true,
        aboutMe: true,
        cgpa: true,
        showStateOnSocialCard: true,
        showAgeOnSocialCard: true,
        showGenderOnSocialCard: true,
        showIitmLevelOnSocialCard: true,
        showCgpaOnSocialCard: true,
        instagramUrl: true,
        linkedinUrl: true,
        isProfileComplete: true,
        appTourCompleted: true,
        appTourCompletedAt: true,
        completedTourVersion: true,
        isIdentityUpdated: true,
        iitmJoinYear: true,
        iitmJoinMonth: true,
        iitmLevel: true,
        iitmUserType: true,
        securityNumber: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Auto-generate security number if missing
    if (!user.securityNumber) {
      const securityNumber = 'SEC' + Math.random().toString(36).substring(2, 9).toUpperCase()
      user = await prisma.user.update({
        where: { id: session.userId },
        data: { securityNumber },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          mobileNumber: true,
          email: true,
          role: true,
          avatar: true,
          gender: true,
          genderChangedAt: true,
          age: true,
          state: true,
          aboutMe: true,
          cgpa: true,
          showStateOnSocialCard: true,
          showAgeOnSocialCard: true,
          showGenderOnSocialCard: true,
          showIitmLevelOnSocialCard: true,
          showCgpaOnSocialCard: true,
          instagramUrl: true,
          linkedinUrl: true,
          isProfileComplete: true,
        appTourCompleted: true,
        appTourCompletedAt: true,
        completedTourVersion: true,
          isIdentityUpdated: true,
          iitmJoinYear: true,
          iitmJoinMonth: true,
          iitmLevel: true,
          iitmUserType: true,
          securityNumber: true,
          createdAt: true,
        },
      })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      name,
      firstName,
      lastName,
      mobileNumber,
      gender,
      age,
      state,
      aboutMe,
      cgpa,
      showStateOnSocialCard,
      showAgeOnSocialCard,
      showGenderOnSocialCard,
      showIitmLevelOnSocialCard,
      showCgpaOnSocialCard,
      instagramUrl,
      linkedinUrl,
    } = await request.json()

    const data: any = {}
    if (nameHasDigit(name, firstName, lastName)) {
      return NextResponse.json({ error: NAME_DIGIT_ERROR }, { status: 400 })
    }
    if (name !== undefined) data.name = name
    if (firstName !== undefined) data.firstName = firstName
    if (lastName !== undefined) data.lastName = lastName
    if (mobileNumber !== undefined) data.mobileNumber = mobileNumber
    if (age !== undefined) data.age = age ? parseInt(age, 10) : null
    if (state !== undefined) data.state = state

    if (instagramUrl !== undefined) {
      if (instagramUrl === '' || instagramUrl === null) {
        data.instagramUrl = null
      } else {
        const cleanUrl = instagramUrl.trim()
        const pattern = /^https:\/\/(www\.)?instagram\.com\/.+/i
        if (!pattern.test(cleanUrl)) {
          return NextResponse.json({ error: 'Please paste a valid Instagram profile link, not just your username.' }, { status: 400 })
        }
        data.instagramUrl = cleanUrl
      }
    }
    if (linkedinUrl !== undefined) {
      if (linkedinUrl === '' || linkedinUrl === null) {
        data.linkedinUrl = null
      } else {
        const cleanUrl = linkedinUrl.trim()
        const pattern = /^https:\/\/(www\.)?linkedin\.com\/in\/.+/i
        if (!pattern.test(cleanUrl)) {
          return NextResponse.json({ error: 'Please paste a valid LinkedIn profile link, not just your username.' }, { status: 400 })
        }
        data.linkedinUrl = cleanUrl
      }
    }
    if (aboutMe !== undefined) {
      if (typeof aboutMe !== 'string') {
        return NextResponse.json({ error: 'About Me must be text' }, { status: 400 })
      }
      if (countWords(aboutMe) > ABOUT_ME_MAX_WORDS) {
        return NextResponse.json({ error: `About Me must be ${ABOUT_ME_MAX_WORDS} words or fewer.` }, { status: 400 })
      }
      data.aboutMe = aboutMe.trim() || null
    }
    if (cgpa !== undefined) {
      if (cgpa === '' || cgpa === null) {
        data.cgpa = null
      } else {
        const parsedCgpa = Number(cgpa)
        if (!Number.isFinite(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 10) {
          return NextResponse.json({ error: 'CGPA must be between 0 and 10.' }, { status: 400 })
        }
        data.cgpa = Math.round(parsedCgpa * 100) / 100
      }
    }
    if (typeof showStateOnSocialCard === 'boolean') data.showStateOnSocialCard = showStateOnSocialCard
    if (typeof showAgeOnSocialCard === 'boolean') data.showAgeOnSocialCard = showAgeOnSocialCard
    if (typeof showGenderOnSocialCard === 'boolean') data.showGenderOnSocialCard = showGenderOnSocialCard
    if (typeof showIitmLevelOnSocialCard === 'boolean') data.showIitmLevelOnSocialCard = showIitmLevelOnSocialCard
    if (typeof showCgpaOnSocialCard === 'boolean') data.showCgpaOnSocialCard = showCgpaOnSocialCard

    // Handle gender update - only allow if not previously changed
    if (gender) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { genderChangedAt: true }
      })
      
      if (user?.genderChangedAt) {
        return NextResponse.json(
          { error: 'Gender can only be changed once' }, 
          { status: 400 }
        )
      }
      
      // Allow gender update and set the timestamp
      if (['MALE', 'FEMALE', 'OTHER'].includes(gender.toUpperCase())) {
        data.gender = gender.toUpperCase()
        data.genderChangedAt = new Date()
      } else {
        return NextResponse.json(
          { error: 'Invalid gender value. Must be MALE, FEMALE, or OTHER' }, 
          { status: 400 }
        )
      }
    }

    // Ensure name is updated if firstName/lastName provided
    if (name === undefined && (firstName !== undefined || lastName !== undefined)) {
        const current = await prisma.user.findUnique({ where: { id: session.userId }, select: { firstName: true, lastName: true } })
        const fn = firstName !== undefined ? firstName : (current?.firstName || '')
        const ln = lastName !== undefined ? lastName : (current?.lastName || '')
        data.name = `${fn} ${ln}`.trim()
    }

    const user = await prisma.user.update({
      where: { id: session.userId },
      data,
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        mobileNumber: true,
        email: true,
        role: true,
        avatar: true,
        gender: true,
        genderChangedAt: true,
        age: true,
        state: true,
        aboutMe: true,
        cgpa: true,
        showStateOnSocialCard: true,
        showAgeOnSocialCard: true,
        showGenderOnSocialCard: true,
        showIitmLevelOnSocialCard: true,
        showCgpaOnSocialCard: true,
        instagramUrl: true,
        linkedinUrl: true,
        isProfileComplete: true,
        isIdentityUpdated: true,
        iitmJoinYear: true,
        iitmJoinMonth: true,
        iitmLevel: true,
        iitmUserType: true,
        createdAt: true,
      },
    })

    logActivity({
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      actionType: ACTION.PROFILE_UPDATED,
      actionDescription: `${session.name} updated their profile`,
      moduleName: MODULE.PROFILE,
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
