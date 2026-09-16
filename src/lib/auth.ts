import jwt from 'jsonwebtoken'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { isCourseEffectivelyDisabled } from '@/lib/course-state'
import { canBypassMaintenance } from '@/lib/maintenance-access'
import { getMaintenanceModeState } from '@/lib/maintenance'

const COOKIE_NAME = 'teaching_llm_token'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required. Generate one with: openssl rand -hex 32')
  }
  return secret
}

export interface JWTPayload {
  userId: string
  email: string
  role: 'MANAGER' | 'ADMIN' | 'STUDENT' | 'INSTRUCTOR'
  name: string
  canTerminate?: boolean
  canCreateStudents?: boolean
  tokenVersion?: number // Added for token rotation/invalidation
}

/**
 * Full user session fetched in a SINGLE DB query.
 * Includes termination status + accessible course IDs.
 */
export interface FullSession extends JWTPayload {
  isTerminated: boolean
  isProfileComplete: boolean
  isIdentityUpdated: boolean
  iitmJoinYear: string | null
  iitmJoinMonth: string | null
  iitmLevel: string | null
  iitmUserType: string | null
  enableDetailedLogs: boolean
  hasSeenWelcome: boolean
  accessibleCourseIds: string[] | null // null = all courses (MANAGER)
  enrollmentTypes: Record<string, string> // courseId → 'LIVE' | 'RECORDED'
  isMaintenanceMode?: boolean
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload
  } catch (err) {
    // Silently handle expired/invalid tokens for getSession
    return null
  }
}

export interface StreamTokenPayload {
  userId: string
  lectureId: string
  role: string
}

export function signStreamToken(userId: string, lectureId: string, role: string): string {
  return jwt.sign({ userId, lectureId, role }, getJwtSecret(), { expiresIn: '4h' })
}

export function verifyStreamToken(token: string): StreamTokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as StreamTokenPayload
  } catch (err) {
    return null
  }
}



/**
 * Extracts the session token from the request cookies or Authorization header.
 * Pure function — no DB calls, no side effects.
 */
async function getTokenFromRequest(): Promise<string | undefined> {
  let token: string | undefined = undefined

  // 1. Try to get token from cookies
  try {
    const cookieStore = await cookies()
    token = cookieStore.get(COOKIE_NAME)?.value
  } catch (e) {
    // In some environments, cookies() might throw if called outside request context
  }

  // 2. Try to get token from Authorization header
  if (!token) {
    try {
      const headerStore = await headers()
      const authHeader = headerStore.get('Authorization') || headerStore.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }
    } catch (e) {
      // headers() might throw if called outside request context
    }
  }

  return token
}

export async function getSession(): Promise<JWTPayload | null> {
  try {
    const token = await getTokenFromRequest()
    if (!token) return null
    
    const payload = verifyToken(token)
    if (!payload) return null

    // Security: Verify token version and termination status from DB
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isTerminated: true, tokenVersion: true },
    })

    if (!user || user.isTerminated) return null

    // Token version mismatch = token was invalidated (password change, forced logout, etc.)
    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

/**
 * Combined auth: decodes JWT + fetches user (isTerminated, enrollments, settings)
 * in ONE DB call (+ settings in parallel). Skips the redundant getSession() DB
 * lookup — directly verifies JWT, then fetches everything needed in a single query.
 */
export async function getFullSession(): Promise<FullSession | null> {
  try {
    // Step 1: Extract and verify JWT (NO database call)
    const token = await getTokenFromRequest()
    if (!token) return null

    const jwtPayload = verifyToken(token)
    if (!jwtPayload) return null

    // Step 2: Fetch user + settings in PARALLEL — ONE user query covers
    // tokenVersion, isTerminated, enrollments, and profile state. This replaces
    // the old flow where getSession() did a separate findUnique for just
    // tokenVersion + isTerminated, followed by another findUnique here.
    const now = new Date()
    let user: any = null
    let maintenanceState: { active: boolean } | null = null

    try {
      [user, maintenanceState] = await Promise.all([
        (prisma.user.findUnique as any)({
          where: { id: jwtPayload.userId },
          select: {
            role: true,
            isTerminated: true,
            tokenVersion: true,
            isProfileComplete: true,
            isIdentityUpdated: true,
            iitmJoinYear: true,
            iitmJoinMonth: true,
            iitmLevel: true,
            iitmUserType: true,
            enableDetailedLogs: true,
            hasSeenWelcome: true,
            enrollments: {
              where: {
                course: {
                  isDisabled: false,
                    OR: [
                      { expiresAt: null },
                      { expiresAt: { gt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) } },
                    ],
                },
              },
              select: { courseId: true, type: true },
            },
            instructorAssignments: {
              select: {
                courseId: true,
                course: {
                  select: { isDisabled: true, expiresAt: true }
                }
              }
            },
          },
        }),
        getMaintenanceModeState().catch((error: any) => {
          console.error('\n[AUTH WARNING] Maintenance mode lookup failed in getFullSession, defaulting to false.')
          console.error('Raw Error:', error?.message || error)
          return { active: false }
        }),
      ])
    } catch (error: any) {
      console.error('\n[AUTH CRITICAL ERROR] User database lookup failed in getFullSession!')
      console.error('This typically indicates the current production DB schema is missing tables or columns defined in code (e.g., Enrollment.type from previous migrations).')
      console.error('Raw Error:', error?.message || error)
      return null
    }

    // Security Check: Token Version Invalidation
    // If user has a tokenVersion in JWT, it MUST match the DB.
    // Exception: If JWT is missing it (backward compatibility), allow it but next login will fix it.
    if (!user || user.isTerminated) return null
    
    if (jwtPayload.tokenVersion !== undefined && jwtPayload.tokenVersion !== user.tokenVersion) {
      return null
    }

    const enrollments = (user.enrollments as { courseId: string; type: string }[] | undefined) ?? []
    const instructorAssignments = (user.instructorAssignments as { courseId: string; course: { isDisabled: boolean; expiresAt: Date | null } }[] | undefined) ?? []
    const userRole = user.role || jwtPayload.role

    const accessibleCourseIds = (userRole === 'MANAGER')
      ? null
      : Array.from(new Set([
          ...enrollments.map(e => e.courseId),
          ...instructorAssignments.filter(a => !isCourseEffectivelyDisabled(a.course, now)).map(a => a.courseId)
        ]))

    return {
      ...jwtPayload,
      role: userRole,
      isTerminated: user.isTerminated,
      isProfileComplete: user.isProfileComplete,
      isIdentityUpdated: user.isIdentityUpdated || false,
      iitmJoinYear: user.iitmJoinYear || null,
      iitmJoinMonth: user.iitmJoinMonth || null,
      iitmLevel: user.iitmLevel || null,
      iitmUserType: user.iitmUserType || null,
      enableDetailedLogs: user.enableDetailedLogs || false,
      hasSeenWelcome: user.hasSeenWelcome || false,
      accessibleCourseIds,
      enrollmentTypes: (userRole === 'MANAGER')
        ? {}
        : Object.fromEntries([
            ...instructorAssignments.map(a => [a.courseId, 'LIVE']),
            ...enrollments.map(e => [e.courseId, e.type || 'LIVE']),
          ]),
      isMaintenanceMode: Boolean(maintenanceState?.active) && !canBypassMaintenance(userRole)
    }
  } catch {
    return null
  }
}

export function getCookieConfig() {
  return {
    name: COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days — matches JWT expiry
      path: '/',
    },
  }
}

export function isManager(role: string) {
  return role === 'MANAGER'
}

export function isSuperAdmin(role: string) {
  return false
}

export function isManagerOrSuperAdmin(role: string) {
  return role === 'MANAGER'
}

export function isAdminOrManager(role: string) {
  return role === 'MANAGER' || role === 'ADMIN'
}

export function canCreateAnnouncements(role: string) {
  return role === 'MANAGER'
}

export function canManageContent(role: string) {
  return role === 'MANAGER'
}

export function canManageEvents(role: string) {
  return role === 'MANAGER'
}

/**
 * Returns the courseIds the user has access to via Enrollment and/or InstructorAssignment.
 * MANAGER: returns null (meaning "all courses, no filtering")
 * ADMIN/INSTRUCTOR/STUDENT: returns string[] of accessible courseIds (may be empty)
 */
export async function getAccessibleCourseIds(
  userId: string,
  role: string
): Promise<string[] | null> {
  if (role === 'MANAGER') return null

  const now = new Date()

  const [assignments, enrollments] = await Promise.all([
    (prisma.instructorAssignment.findMany as any)({
      where: { instructorId: userId },
      select: {
        courseId: true,
        course: {
          select: {
            isDisabled: true,
            expiresAt: true,
          },
        },
      },
    }),
    (prisma.enrollment.findMany as any)({
      where: { 
        userId,
        course: {
          isDisabled: false,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) } }
          ]
        }
      },
      select: { courseId: true },
    })
  ])

  const assignedCourseIds = (assignments || [])
    .filter((a: any) => !isCourseEffectivelyDisabled(a.course, now))
    .map((a: any) => a.courseId)
  const enrolledCourseIds = (enrollments || []).map((e: any) => e.courseId)

  return Array.from(new Set([...assignedCourseIds, ...enrolledCourseIds]))
}

/**
 * Robustly checks if a student is authorized to access a content item (lecture/material).
 * Verifies:
 * 1. Student has an active enrollment in the native course OR any course sharing the content.
 * 2. Course is not disabled and not expired.
 * 3. Handles DEMO enrollment restrictions (blocks non-demo content for demo users).
 */
export async function isStudentEnrolledInContent(
  userId: string,
  contentId: string,
  nativeCourseId?: string | null,
  isContentDemo: boolean = false
): Promise<boolean> {
  const now = new Date()
  const validCourseFilter = {
    isDisabled: false,
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) } }
    ]
  }

  // 1. Direct enrollment check on native course
  if (nativeCourseId) {
    const directEnrollment = await prisma.enrollment.findFirst({
      where: {
        userId,
        courseId: nativeCourseId,
        course: validCourseFilter
      },
      select: { type: true }
    })

    if (directEnrollment) {
      if (directEnrollment.type === 'DEMO' && !isContentDemo) {
        return false // DEMO locked
      }
      return true
    }
  }

  // 2. Shared content check via TopicSharedContent
  const sharedLink = await prisma.topicSharedContent.findFirst({
    where: {
      contentId,
      topic: {
        course: validCourseFilter
      }
    },
    select: {
      topic: {
        select: {
          course: {
            select: {
              enrollments: {
                where: { userId },
                select: { type: true }
              }
            }
          }
        }
      }
    }
  })

  const sharedEnrollment = sharedLink?.topic?.course?.enrollments?.[0]
  if (sharedEnrollment) {
    if (sharedEnrollment.type === 'DEMO' && !isContentDemo) {
      return false // DEMO locked
    }
    return true
  }

  return false
}
