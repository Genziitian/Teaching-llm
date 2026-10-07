import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession, isAdminOrManager } from '@/lib/auth'
import { getSocialBadgeDefinition, getSystemSocialBadgesForRole } from '@/lib/social-badges'
import { getSocialCardAboutMe } from '@/lib/social-card-defaults'

export const dynamic = 'force-dynamic'

function formatGender(gender?: string | null) {
  if (!gender) return null
  return gender.charAt(0) + gender.slice(1).toLowerCase()
}

function formatCgpa(cgpa?: number | null) {
  if (typeof cgpa !== 'number' || Number.isNaN(cgpa)) return null
  return Number(cgpa.toFixed(2))
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        name: true,
        role: true,
        avatar: true,
        aboutMe: true,
        state: true,
        age: true,
        gender: true,
        iitmLevel: true,
        cgpa: true,
        showStateOnSocialCard: true,
        showAgeOnSocialCard: true,
        showGenderOnSocialCard: true,
        showIitmLevelOnSocialCard: true,
        showCgpaOnSocialCard: true,
        instagramUrl: true,
        linkedinUrl: true,
        mobileNumber: true,
        isTerminated: true,
        badges: {
          orderBy: { assignedAt: 'asc' },
          select: {
            id: true,
            badgeId: true,
            assignedAt: true,
          },
        },
      },
    })

    if (!user || user.isTerminated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isSelf = session.userId === user.id
    const viewerIsStaff = isAdminOrManager(session.role)
    const targetIsManager = user.role === 'MANAGER' || (user.role === 'ADMIN' || user.role === 'MODERATOR')

    const publicFields: { key: string; label: string; value: string | number }[] = []
    if (user.showStateOnSocialCard && user.state) {
      publicFields.push({ key: 'state', label: 'State', value: user.state })
    }
    if (user.showAgeOnSocialCard && typeof user.age === 'number') {
      publicFields.push({ key: 'age', label: 'Age', value: user.age })
    }
    if (user.showGenderOnSocialCard && user.gender) {
      publicFields.push({ key: 'gender', label: 'Gender', value: formatGender(user.gender) || user.gender })
    }
    if (user.showIitmLevelOnSocialCard && user.iitmLevel) {
      publicFields.push({ key: 'iitmLevel', label: 'IITM Level', value: user.iitmLevel })
    }
    const publicCgpa = formatCgpa(user.cgpa)
    if (user.showCgpaOnSocialCard && publicCgpa !== null) {
      publicFields.push({ key: 'cgpa', label: 'CGPA', value: publicCgpa })
    }

    const assignedBadges = user.badges
      .map(badge => {
        const definition = getSocialBadgeDefinition(badge.badgeId)
        if (!definition) return null
        return {
          id: badge.id,
          badgeId: badge.badgeId,
          label: definition.label,
          category: definition.category,
          system: Boolean(definition.system),
          assignedAt: badge.assignedAt,
        }
      })
      .filter(Boolean)
    const assignedBadgeIds = new Set(assignedBadges.map((badge: any) => badge.badgeId))
    const systemBadges = getSystemSocialBadgesForRole(user.role)
      .filter(badge => !assignedBadgeIds.has(badge.id))
      .map(badge => ({
        id: `system_${badge.id}`,
        badgeId: badge.id,
        label: badge.label,
        category: badge.category,
        system: true,
        assignedAt: null,
      }))
    const badges = [...systemBadges, ...assignedBadges]

    const isViewerManager = session.role === 'MANAGER'
    let whatsappUrl: string | null = null
    let whatsappError: string | null = null

    if (isViewerManager && !isSelf) {
      if (user.mobileNumber) {
        const clean = user.mobileNumber.replace(/\D/g, '')
        if (clean.length > 0) {
          const finalNumber = clean.length === 10 ? '91' + clean : clean
          whatsappUrl = `https://wa.me/${finalNumber}`
        } else {
          whatsappError = 'WhatsApp number unavailable'
        }
      } else {
        whatsappError = 'WhatsApp number unavailable'
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        gender: user.gender,
        aboutMe: getSocialCardAboutMe(user.aboutMe, user.role),
        publicFields,
        badges,
        instagramUrl: user.instagramUrl,
        linkedinUrl: user.linkedinUrl,
      },
      viewer: {
        isSelf,
        isStaff: viewerIsStaff,
        canReport: !isSelf && !viewerIsStaff && !targetIsManager,
        canTalkToManager: !isSelf && !viewerIsStaff && user.role === 'MANAGER',
        canViewFullAvatar: isSelf,
        canOpenManagerProfile: viewerIsStaff && !isSelf,
        whatsappUrl,
        whatsappError,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Error fetching social card:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
