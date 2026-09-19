export interface CourseStateLike {
  isDisabled?: boolean | null
  expiresAt?: Date | string | null
}

export function isCourseExpired(course: CourseStateLike, now = new Date()) {
  if (!course.expiresAt) return false
  const expiresAt = course.expiresAt instanceof Date ? course.expiresAt : new Date(course.expiresAt)
  return expiresAt.getTime() <= now.getTime()
}

/**
 * True when a course must NOT appear in pickers / assignment selectors.
 * Ignores manager role — disabled and expired courses stay hidden from selection UIs.
 */
export function isCourseHiddenFromSelection(course: CourseStateLike, now = new Date()) {
  return !!course.isDisabled || isCourseExpired(course, now)
}

export function isCourseSelectable(course: CourseStateLike, now = new Date()) {
  return !isCourseHiddenFromSelection(course, now)
}

export function isCourseInGracePeriod(course: CourseStateLike, now = new Date()) {
  if (!course.expiresAt) return false
  const expiresAt = course.expiresAt instanceof Date ? course.expiresAt : new Date(course.expiresAt)
  const graceEnd = new Date(expiresAt.getTime() + 3 * 24 * 60 * 60 * 1000)
  return now.getTime() > expiresAt.getTime() && now.getTime() <= graceEnd.getTime()
}

export function isCoursePastGracePeriod(course: CourseStateLike, now = new Date()) {
  if (!course.expiresAt) return false
  const expiresAt = course.expiresAt instanceof Date ? course.expiresAt : new Date(course.expiresAt)
  const graceEnd = new Date(expiresAt.getTime() + 3 * 24 * 60 * 60 * 1000)
  return now.getTime() > graceEnd.getTime()
}

export function getGracePeriodRemainingHours(course: CourseStateLike, now = new Date()) {
  if (!course.expiresAt) return 0
  const expiresAt = course.expiresAt instanceof Date ? course.expiresAt : new Date(course.expiresAt)
  const graceEnd = new Date(expiresAt.getTime() + 3 * 24 * 60 * 60 * 1000)
  const diffMs = graceEnd.getTime() - now.getTime()
  if (diffMs <= 0) return 0
  return Math.ceil(diffMs / (1000 * 60 * 60))
}

export function isCourseEffectivelyDisabled(
  course: CourseStateLike,
  userRoleOrNow?: string | Date | null,
  now = new Date()
) {
  let userRole: string | null = null
  let actualNow = now

  if (userRoleOrNow instanceof Date) {
    actualNow = userRoleOrNow
  } else if (typeof userRoleOrNow === 'string') {
    userRole = userRoleOrNow
  }

  // Managers always have unrestricted access to any course regardless of state
  if (userRole === 'MANAGER') return false
  return !!course.isDisabled || isCourseExpired(course, actualNow)
}


