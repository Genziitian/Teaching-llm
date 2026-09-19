import { SignJWT, importPKCS8 } from 'jose'
import { prisma } from '@/lib/db'

const GOOGLE_TOKEN_AUDIENCE = 'https://oauth2.googleapis.com/token'
const GOOGLE_GROUP_SCOPE = 'https://www.googleapis.com/auth/admin.directory.group.member https://www.googleapis.com/auth/admin.directory.group.readonly'
const GROUP_SYNC_MAX_ATTEMPTS = 3
const CRON_SECRET = process.env.CRON_SECRET?.trim() || ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || ''

const GOOGLE_WORKSPACE_DOMAIN = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim().toLowerCase() || ''
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || ''
const GOOGLE_WORKSPACE_ADMIN_EMAIL = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL?.trim() || ''

/**
 * Normalize PEM private key from env (Render/Vercel often wrap in quotes or escape \\n).
 * Bad formatting causes: "Found a character that cannot be part of a valid base64 string."
 */
function normalizeServiceAccountPrivateKey(raw?: string | null): string {
  if (!raw) return ''
  let key = raw.trim()
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }
  // Handle double-escaped newlines from JSON-style env paste
  key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n')
  return key.trim()
}

const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = normalizeServiceAccountPrivateKey(
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
)

type SyncAction = 'ADD' | 'REMOVE'
type SyncStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

/**
 * Acquire lock to prevent concurrent processing
 * Returns true if lock was acquired, false if already processing
 */
async function acquireSyncLock(): Promise<boolean> {
  try {
    const result = await (prisma as any).groupSyncLock.update({
      where: { id: 'singleton' },
      data: {
        isProcessing: true,
        lockedAt: new Date(),
      },
    })
    return true
  } catch (error) {
    return false
  }
}

/**
 * Release lock after processing
 */
async function releaseSyncLock(): Promise<void> {
  try {
    await (prisma as any).groupSyncLock.update({
      where: { id: 'singleton' },
      data: {
        isProcessing: false,
        lockedAt: null,
      },
    })
  } catch (error) {
    console.error('[Google Group Sync] Failed to release lock:', error)
  }
}

/**
 * Check if processing is already in progress
 */
async function isProcessing(): Promise<boolean> {
  try {
    const lock = await (prisma as any).groupSyncLock.findUnique({
      where: { id: 'singleton' },
    })
    
    if (!lock || !lock.isProcessing) {
      return false
    }

    // Check for stale lock (older than 60 seconds)
    if (lock.lockedAt) {
      const lockAgeSeconds = (new Date().getTime() - new Date(lock.lockedAt).getTime()) / 1000
      if (lockAgeSeconds > 60) {
        console.warn('[Google Group Sync] Stale lock detected (older than 60s), auto-resetting')
        return false 
      }
    }

    return true
  } catch (error) {
    return false
  }
}

let pendingTrigger: NodeJS.Timeout | null = null

/**
 * Trigger async processing of Google Group sync jobs.
 * Uses a 10-second buffer on the FIRST call to batch multiple incoming jobs.
 * After each successful batch, automatically re-triggers with a 2-second delay
 * if there are still PENDING jobs remaining (chain processing until queue empty).
 */
export function triggerGoogleGroupSyncProcessing(isChained = false): void {
  // If a trigger is already scheduled, don't create another one
  if (pendingTrigger) return

  // Use a short 2s delay when chaining (queue already filled), 10s for initial batching
  const delay = isChained ? 2000 : 10000

  pendingTrigger = setTimeout(async () => {
    pendingTrigger = null // Clear so new triggers can be scheduled

    try {
      const result = await processGoogleGroupSyncJobs()
      if (result.processed > 0) {
        console.log(`[Google Group Sync] Batch done — ${result.processed} jobs: ${result.succeeded} succeeded, ${result.failed} failed${
          result.hasMore ? ' — more pending, continuing...' : ' — queue clear'
        }`)
      }

      // If there are still jobs in the queue, chain the next run automatically
      if (result.hasMore) {
        triggerGoogleGroupSyncProcessing(true)
      }
    } catch (error) {
      console.error('[Google Group Sync] Direct processing failed:', error instanceof Error ? error.message : String(error))
    }
  }, delay)
}

export function validateGoogleGroupEmail(rawEmail?: string | null) {
  if (!rawEmail || !rawEmail.trim()) return null

  // Support comma-separated multiple emails (max 5)
  const rawEmails = rawEmail.split(',').map(e => e.trim()).filter(e => e)
  if (rawEmails.length === 0) return null
  if (rawEmails.length > 5) {
    throw new Error('Maximum 5 Google Group Emails allowed per course')
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const validated: string[] = []

  for (const raw of rawEmails) {
    const email = normalizeEmail(raw)
    if (!emailPattern.test(email)) {
      throw new Error(`Google Group Email "${raw}" is not a valid email address`)
    }
    if (GOOGLE_WORKSPACE_DOMAIN && !email.endsWith(`@${GOOGLE_WORKSPACE_DOMAIN}`)) {
      throw new Error(`Google Group Email "${raw}" must belong to @${GOOGLE_WORKSPACE_DOMAIN}`)
    }
    validated.push(email)
  }

  // Deduplicate
  const unique = validated.filter((value, index, self) => self.indexOf(value) === index)
  return unique.join(',')
}

/**
 * Parse a comma-separated googleGroupEmail string into an array of individual emails.
 */
export function parseGoogleGroupEmails(googleGroupEmail: string | null | undefined): string[] {
  if (!googleGroupEmail) return []
  return googleGroupEmail.split(',').map(e => e.trim()).filter(e => e)
}

export async function queueGoogleGroupSyncJobs(
  db: any,
  {
    userEmail,
    courseIds,
    action,
    enrollmentTypeMap,
  }: {
    userEmail: string
    courseIds: string[]
    action: SyncAction
    enrollmentTypeMap?: Record<string, string>
  }
) {
  const normalizedUserEmail = normalizeEmail(userEmail)
  const uniqueCourseIds = Array.from(new Set(courseIds.filter(Boolean)))
  if (!normalizedUserEmail || uniqueCourseIds.length === 0) return 0

  const courses = await db.course.findMany({
    where: {
      id: { in: uniqueCourseIds },
      OR: [
        { googleGroupEmail: { not: null } },
        { liveGoogleGroupEmail: { not: null } }
      ]
    },
    select: {
      id: true,
      googleGroupEmail: true,
      liveGoogleGroupEmail: true,
    },
  })

  if (courses.length === 0) return 0

  let enrollmentsMap = enrollmentTypeMap || {}
  if (!enrollmentTypeMap) {
    const user = await db.user.findUnique({
      where: { email: normalizedUserEmail },
      select: {
        id: true,
        enrollments: {
          where: { courseId: { in: uniqueCourseIds } },
          select: { courseId: true, type: true }
        }
      }
    })
    if (user && user.enrollments) {
      enrollmentsMap = {}
      for (const e of user.enrollments) {
        enrollmentsMap[e.courseId] = e.type as 'LIVE' | 'RECORDED'
      }
    }
  }

  const explicitJobs: Array<{
    userEmail: string
    courseId: string
    groupEmail: string
    action: SyncAction
  }> = []

  for (const course of courses) {
    const enrollmentType = enrollmentsMap[course.id] || 'RECORDED'
    if (enrollmentType === 'DEMO') {
      if (action === 'REMOVE') {
        if (course.googleGroupEmail) {
          const recEmails = parseGoogleGroupEmails(course.googleGroupEmail)
          for (const ge of recEmails) {
            explicitJobs.push({ userEmail: normalizedUserEmail, courseId: course.id, groupEmail: ge, action: 'REMOVE' })
          }
        }
        if (course.liveGoogleGroupEmail) {
          const liveEmails = parseGoogleGroupEmails(course.liveGoogleGroupEmail)
          for (const ge of liveEmails) {
            explicitJobs.push({ userEmail: normalizedUserEmail, courseId: course.id, groupEmail: ge, action: 'REMOVE' })
          }
        }
      }
      continue
    }
    const hasLiveGroup = Boolean(course.liveGoogleGroupEmail?.trim())

    if (action === 'ADD') {
      if (hasLiveGroup && enrollmentType === 'LIVE') {
        const liveEmails = parseGoogleGroupEmails(course.liveGoogleGroupEmail)
        for (const ge of liveEmails) {
          explicitJobs.push({ userEmail: normalizedUserEmail, courseId: course.id, groupEmail: ge, action: 'ADD' })
        }
        if (course.googleGroupEmail) {
          const recEmails = parseGoogleGroupEmails(course.googleGroupEmail)
          for (const ge of recEmails) {
            explicitJobs.push({ userEmail: normalizedUserEmail, courseId: course.id, groupEmail: ge, action: 'REMOVE' })
          }
        }
      } else {
        if (course.googleGroupEmail) {
          const recEmails = parseGoogleGroupEmails(course.googleGroupEmail)
          for (const ge of recEmails) {
            explicitJobs.push({ userEmail: normalizedUserEmail, courseId: course.id, groupEmail: ge, action: 'ADD' })
          }
        }
        if (hasLiveGroup) {
          const liveEmails = parseGoogleGroupEmails(course.liveGoogleGroupEmail)
          for (const ge of liveEmails) {
            explicitJobs.push({ userEmail: normalizedUserEmail, courseId: course.id, groupEmail: ge, action: 'REMOVE' })
          }
        }
      }
    } else if (action === 'REMOVE') {
      if (course.googleGroupEmail) {
        const recEmails = parseGoogleGroupEmails(course.googleGroupEmail)
        for (const ge of recEmails) {
          explicitJobs.push({ userEmail: normalizedUserEmail, courseId: course.id, groupEmail: ge, action: 'REMOVE' })
        }
      }
      if (course.liveGoogleGroupEmail) {
        const liveEmails = parseGoogleGroupEmails(course.liveGoogleGroupEmail)
        for (const ge of liveEmails) {
          explicitJobs.push({ userEmail: normalizedUserEmail, courseId: course.id, groupEmail: ge, action: 'REMOVE' })
        }
      }
    }
  }

  return queueExplicitGoogleGroupSyncJobs(db, explicitJobs)
}

/**
 * Re-evaluates and queues Google Group sync jobs for all active enrollments of a course.
 * Triggered when an admin configures or updates group emails for a course.
 */
export async function reSyncCourseGroupMembers(db: any, courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      googleGroupEmail: true,
      liveGoogleGroupEmail: true,
    },
  })

  if (!course) return 0

  const enrollments = await db.enrollment.findMany({
    where: { courseId },
    select: {
      type: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  })

  const explicitJobs: Array<{
    userEmail: string
    courseId: string
    groupEmail: string
    action: SyncAction
  }> = []

  const hasLiveGroup = Boolean(course.liveGoogleGroupEmail?.trim())
  const hasRecordedGroup = Boolean(course.googleGroupEmail?.trim())

  for (const enrollment of enrollments) {
    if (!enrollment.user?.email) continue
    const userEmail = normalizeEmail(enrollment.user.email)
    const enrollmentType = enrollment.type

    if (hasLiveGroup && enrollmentType === 'LIVE') {
      for (const ge of parseGoogleGroupEmails(course.liveGoogleGroupEmail)) {
        explicitJobs.push({ userEmail, courseId, groupEmail: ge, action: 'ADD' })
      }
      if (hasRecordedGroup) {
        for (const ge of parseGoogleGroupEmails(course.googleGroupEmail)) {
          explicitJobs.push({ userEmail, courseId, groupEmail: ge, action: 'REMOVE' })
        }
      }
    } else {
      if (hasRecordedGroup) {
        for (const ge of parseGoogleGroupEmails(course.googleGroupEmail)) {
          explicitJobs.push({ userEmail, courseId, groupEmail: ge, action: 'ADD' })
        }
      }
      if (hasLiveGroup) {
        for (const ge of parseGoogleGroupEmails(course.liveGoogleGroupEmail)) {
          explicitJobs.push({ userEmail, courseId, groupEmail: ge, action: 'REMOVE' })
        }
      }
    }
  }

  return queueExplicitGoogleGroupSyncJobs(db, explicitJobs)
}

/**
 * Handles Google Group migration when a user upgrades from RECORDED to LIVE batch.
 */
export async function handleGoogleGroupEnrollmentUpgrade(
  db: any,
  { userEmail, courseId }: { userEmail: string; courseId: string }
) {
  return queueGoogleGroupSyncJobs(db, {
    userEmail,
    courseIds: [courseId],
    action: 'ADD',
    enrollmentTypeMap: { [courseId]: 'LIVE' },
  })
}

export async function queueExplicitGoogleGroupSyncJobs(
  db: any,
  jobs: Array<{
    userEmail: string
    courseId: string
    groupEmail: string
    action: SyncAction
  }>
) {
  if (jobs.length === 0) return 0

  const normalizedJobs = jobs
    .map(job => ({
      userEmail: normalizeEmail(job.userEmail),
      courseId: job.courseId,
      groupEmail: normalizeEmail(job.groupEmail),
      action: job.action,
      status: 'PENDING' as SyncStatus,
    }))
    .filter(job => job.userEmail && job.courseId && job.groupEmail)

  if (normalizedJobs.length === 0) return 0

  const pendingJobs = await db.groupSyncJob.findMany({
    where: {
      status: 'PENDING',
      OR: normalizedJobs.map(job => ({
        userEmail: job.userEmail,
        courseId: job.courseId,
        groupEmail: job.groupEmail,
        action: job.action,
      })),
    },
    select: {
      userEmail: true,
      courseId: true,
      groupEmail: true,
      action: true,
    },
  })

  const pendingKeys = new Set(
    pendingJobs.map((job: { userEmail: string; courseId: string; groupEmail: string; action: SyncAction }) =>
      `${job.userEmail}:${job.courseId}:${job.groupEmail}:${job.action}`
    )
  )

  const filteredJobs = normalizedJobs.filter(job =>
    !pendingKeys.has(`${job.userEmail}:${job.courseId}:${job.groupEmail}:${job.action}`)
  )

  if (filteredJobs.length === 0) return 0

  await db.groupSyncJob.createMany({ data: filteredJobs })

  // Trigger async processing (fire-and-forget, outside transaction)
  process.nextTick(() => triggerGoogleGroupSyncProcessing())

  return filteredJobs.length
}

async function getGoogleAccessToken() {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !GOOGLE_WORKSPACE_ADMIN_EMAIL) {
    throw new Error('Google Group sync credentials are not fully configured')
  }

  if (!GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY looks invalid (missing BEGIN PRIVATE KEY). Re-paste the full PEM including headers.'
    )
  }

  const now = Math.floor(Date.now() / 1000)
  let key
  try {
    key = await importPKCS8(GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, 'RS256')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Failed to parse GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (${msg}). Fix the PEM in env (no broken base64 / use real newlines or \\n), then Retry Failed Jobs.`
    )
  }
  const assertion = await new SignJWT({ scope: GOOGLE_GROUP_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(GOOGLE_SERVICE_ACCOUNT_EMAIL)
    .setSubject(GOOGLE_WORKSPACE_ADMIN_EMAIL)
    .setAudience(GOOGLE_TOKEN_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)

  const response = await fetch(GOOGLE_TOKEN_AUDIENCE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  const data = await response.json()
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to obtain Google access token')
  }

  return data.access_token as string
}

async function addMemberToGroup(accessToken: string, userEmail: string, groupEmail: string) {
  const response = await fetch(`https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: userEmail,
      role: 'MEMBER',
    }),
  })

  if (response.ok || response.status === 409) {
    return
  }

  const data = await response.json().catch(() => null)
  throw new Error(data?.error?.message || `Google add member failed with status ${response.status}`)
}

async function removeMemberFromGroup(accessToken: string, userEmail: string, groupEmail: string) {
  const response = await fetch(`https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members/${encodeURIComponent(userEmail)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (response.ok || response.status === 404) {
    return
  }

  const data = await response.json().catch(() => null)
  throw new Error(data?.error?.message || `Google remove member failed with status ${response.status}`)
}

export async function retryFailedGoogleGroupSyncJobs() {
  const result = await (prisma as any).groupSyncJob.updateMany({
    where: {
      status: 'FAILED',
    },
    data: {
      status: 'PENDING',
      attemptCount: 0,
      lastError: null,
    },
  })

  // Trigger async processing immediately
  process.nextTick(() => triggerGoogleGroupSyncProcessing())

  return { resetCount: result.count }
}

export async function processGoogleGroupSyncJobs(force = false) {
  // Check if already processing to prevent concurrent execution unless forced
  if (force) {
    await releaseSyncLock()
  } else if (await isProcessing()) {
    return { processed: 0, succeeded: 0, failed: 0, skipped: true }
  }

  // Acquire lock
  const lockAcquired = await acquireSyncLock()
  if (!lockAcquired) {
    return { processed: 0, succeeded: 0, failed: 0, skipped: true }
  }

  try {
    // 1. Initial count of pending jobs
    const remainingCount = await (prisma as any).groupSyncJob.count({
      where: {
        status: 'PENDING',
        attemptCount: { lt: GROUP_SYNC_MAX_ATTEMPTS },
      },
    })

    if (remainingCount === 0) {
      return { processed: 0, succeeded: 0, failed: 0 }
    }

    // 2. High-Performance Batch Size & Concurrency (10x Speedup)
    const batchSize = Math.min(250, remainingCount)
    const concurrency = 10

    console.log(`[Google Group Sync] Processing batch: ${remainingCount} users pending, pulling next ${batchSize}`)

    const jobs = await (prisma as any).groupSyncJob.findMany({
      where: {
        status: 'PENDING',
        attemptCount: { lt: GROUP_SYNC_MAX_ATTEMPTS },
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    })

    let accessToken: string
    try {
      accessToken = await getGoogleAccessToken()
    } catch (tokenErr: any) {
      const errMsg = tokenErr instanceof Error ? tokenErr.message : String(tokenErr)
      console.error('[Google Group Sync] Access token failed:', errMsg)

      for (const job of jobs) {
        const nextAttemptCount = (job.attemptCount || 0) + 1
        await (prisma as any).groupSyncJob.update({
          where: { id: job.id },
          data: {
            attemptCount: nextAttemptCount,
            status: nextAttemptCount >= GROUP_SYNC_MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
            lastError: errMsg,
          },
        })
      }

      return { processed: jobs.length, succeeded: 0, failed: jobs.length, error: errMsg }
    }
    let succeeded = 0
    let failed = 0

    let firstError = ''

    // 3. Parallel Chunk Processing with 50ms Delays for Max Speed
    for (let i = 0; i < jobs.length; i += concurrency) {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      const chunk = jobs.slice(i, i + concurrency)
      
      await Promise.allSettled(chunk.map(async (job: any) => {
        try {
          // Mark as PROCESSING
          await (prisma as any).groupSyncJob.update({
            where: { id: job.id },
            data: {
              status: 'PROCESSING',
            },
          })

          // Execute the sync operation
          if (job.action === 'ADD') {
            await addMemberToGroup(accessToken, job.userEmail, job.groupEmail)
          } else {
            await removeMemberFromGroup(accessToken, job.userEmail, job.groupEmail)
          }

          // Mark as SUCCESS
          await (prisma as any).groupSyncJob.update({
            where: { id: job.id },
            data: {
              status: 'SUCCESS',
              lastError: null,
            },
          })
          succeeded++
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)
          if (!firstError) firstError = errMsg

          const isRateLimit = errMsg.toLowerCase().includes('request rate higher than configured') ||
                              errMsg.toLowerCase().includes('ratelimitexceeded') ||
                              errMsg.toLowerCase().includes('quota')

          console.error(`[Google Group Sync] Job ${job.id} failed (${isRateLimit ? 'RATE LIMITED' : 'ERROR'}):`, errMsg)

          if (isRateLimit) {
            // Do NOT increment attempt count on rate limit! Keep status PENDING so it can be safely retried.
            await (prisma as any).groupSyncJob.update({
              where: { id: job.id },
              data: {
                status: 'PENDING',
                lastError: 'Request rate higher than configured (Rate Limited - Will Auto Retry)',
              },
            })
            // Pause execution briefly (3s) to allow Google API quota window to reset
            await new Promise(resolve => setTimeout(resolve, 3000))
          } else {
            const nextAttemptCount = job.attemptCount + 1
            await (prisma as any).groupSyncJob.update({
              where: { id: job.id },
              data: {
                attemptCount: nextAttemptCount,
                status: nextAttemptCount >= GROUP_SYNC_MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
                lastError: errMsg || 'Unknown Google sync error',
              },
            })
            failed++
          }
        }
      }))
    }

    // 4. Automatic Cleanup
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      await (prisma as any).groupSyncJob.deleteMany({
        where: {
          status: 'SUCCESS',
          createdAt: { lt: thirtyDaysAgo },
        },
      })
    } catch (cleanupError) {
      console.error('[Google Group Sync] Cleanup failed:', cleanupError)
    }

    // 5. Final check for more jobs
    const finalCount = await (prisma as any).groupSyncJob.count({
      where: {
        status: 'PENDING',
        attemptCount: { lt: GROUP_SYNC_MAX_ATTEMPTS },
      },
    })

    return { processed: jobs.length, succeeded, failed, sampleError: firstError, hasMore: finalCount > 0 }
  } finally {
    // Always release lock
    await releaseSyncLock()
  }
}

/**
 * Fetch actual member count from Google Groups Admin API for each group email.
 * Returns a map of groupEmail → { googleCount, error? }
 */
export async function getGoogleGroupMemberCounts(
  groupEmails: string[]
): Promise<Record<string, { googleCount: number; error?: string }>> {
  const results: Record<string, { googleCount: number; error?: string }> = {}

  if (groupEmails.length === 0) return results

  let accessToken: string
  try {
    accessToken = await getGoogleAccessToken()
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Failed to get access token'
    for (const email of groupEmails) {
      results[email] = { googleCount: -1, error: errMsg }
    }
    return results
  }

  // Fetch counts sequentially with small delay to avoid rate limits
  for (let i = 0; i < groupEmails.length; i++) {
    const groupEmail = groupEmails[i].trim().toLowerCase()
    
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    try {
      // Use the Groups.get endpoint which returns directMembersCount
      const response = await fetch(
        `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const errMsg = data?.error?.message || `HTTP ${response.status}`
        results[groupEmail] = { googleCount: -1, error: errMsg }
        continue
      }

      const data = await response.json()
      results[groupEmail] = {
        googleCount: typeof data.directMembersCount === 'string'
          ? parseInt(data.directMembersCount, 10)
          : (data.directMembersCount ?? -1),
      }
    } catch (err) {
      results[groupEmail] = {
        googleCount: -1,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  return results
}

/**
 * List ALL members of a Google Group (handles pagination).
 * Returns array of lowercase email strings.
 */
async function listGoogleGroupMembers(accessToken: string, groupEmail: string): Promise<string[]> {
  const allMembers: string[] = []
  let nextPageToken: string | undefined

  do {
    const url = new URL(`https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members`)
    url.searchParams.set('maxResults', '200')
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken)

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(data?.error?.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    if (data.members && Array.isArray(data.members)) {
      for (const member of data.members) {
        if (member.email) {
          allMembers.push(member.email.toLowerCase().trim())
        }
      }
    }

    nextPageToken = data.nextPageToken
    // Brief delay between pages to avoid rate limits
    if (nextPageToken) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  } while (nextPageToken)

  return allMembers
}

/**
 * Reconcile Google Groups with DB assignments.
 * 
 * For each notification pool email:
 * 1. Fetches actual members from Google Groups API
 * 2. Compares with DB (which users have this email in notificationGroupEmails)
 * 3. Queues REMOVE jobs for anyone in Google but NOT in DB (extras)
 * 4. Queues ADD jobs for anyone in DB but NOT in Google (missing)
 * 
 * This cleans up overfilled groups (655, 994 members → 500).
 */
export async function reconcileGoogleGroupMembers(
  groupEmails: string[]
): Promise<{
  results: Array<{
    groupEmail: string
    googleMemberCount: number
    dbMemberCount: number
    extrasInGoogle: number
    missingInGoogle: number
    removeJobsQueued: number
    addJobsQueued: number
    error?: string
  }>
  totalRemoveJobsQueued: number
  totalAddJobsQueued: number
}> {
  const results: Array<{
    groupEmail: string
    googleMemberCount: number
    dbMemberCount: number
    extrasInGoogle: number
    missingInGoogle: number
    removeJobsQueued: number
    addJobsQueued: number
    error?: string
  }> = []

  let totalRemoveJobsQueued = 0
  let totalAddJobsQueued = 0

  if (groupEmails.length === 0) return { results, totalRemoveJobsQueued, totalAddJobsQueued }

  let accessToken: string
  try {
    accessToken = await getGoogleAccessToken()
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Failed to get access token'
    for (const email of groupEmails) {
      results.push({
        groupEmail: email,
        googleMemberCount: -1,
        dbMemberCount: 0,
        extrasInGoogle: 0,
        missingInGoogle: 0,
        removeJobsQueued: 0,
        addJobsQueued: 0,
        error: errMsg,
      })
    }
    return { results, totalRemoveJobsQueued, totalAddJobsQueued }
  }

  for (const groupEmail of groupEmails) {
    const normGroupEmail = groupEmail.trim().toLowerCase()

    try {
      // 1. Get actual Google members
      const googleMembers = await listGoogleGroupMembers(accessToken, normGroupEmail)
      const googleMemberSet = new Set(googleMembers)

      // 2. Get DB assignments (users who have this email in their notificationGroupEmails)
      const dbUsers = await prisma.user.findMany({
        where: { notificationGroupEmails: { contains: normGroupEmail } },
        select: { email: true },
      })
      const dbEmailSet = new Set(dbUsers.map(u => u.email.toLowerCase().trim()))

      // 3. Find extras (in Google but NOT in DB)
      const extras = googleMembers.filter(e => !dbEmailSet.has(e))

      // 4. Find missing (in DB but NOT in Google)
      const missing = Array.from(dbEmailSet).filter(e => !googleMemberSet.has(e))

      // 5. Queue REMOVE jobs for extras
      let removeQueued = 0
      for (const extraEmail of extras) {
        // Don't remove workspace admin or service accounts
        if (extraEmail.endsWith(`@${process.env.GOOGLE_WORKSPACE_DOMAIN?.trim().toLowerCase() || ''}`)) {
          continue
        }

        const existing = await prisma.groupSyncJob.findFirst({
          where: {
            userEmail: extraEmail,
            groupEmail: normGroupEmail,
            action: 'REMOVE',
            status: { in: ['PENDING', 'PROCESSING'] },
          },
        })
        if (!existing) {
          await prisma.groupSyncJob.create({
            data: {
              userEmail: extraEmail,
              groupEmail: normGroupEmail,
              action: 'REMOVE',
              groupType: 'NOTIFICATION',
              status: 'PENDING',
              attemptCount: 0,
            },
          })
          removeQueued++
        }
      }

      // 6. Queue ADD jobs for missing
      let addQueued = 0
      for (const missingEmail of missing) {
        const existing = await prisma.groupSyncJob.findFirst({
          where: {
            userEmail: missingEmail,
            groupEmail: normGroupEmail,
            action: 'ADD',
            status: { in: ['PENDING', 'PROCESSING', 'SUCCESS'] },
          },
        })
        if (!existing) {
          await prisma.groupSyncJob.create({
            data: {
              userEmail: missingEmail,
              groupEmail: normGroupEmail,
              action: 'ADD',
              groupType: 'NOTIFICATION',
              status: 'PENDING',
              attemptCount: 0,
            },
          })
          addQueued++
        }
      }

      totalRemoveJobsQueued += removeQueued
      totalAddJobsQueued += addQueued

      results.push({
        groupEmail: normGroupEmail,
        googleMemberCount: googleMembers.length,
        dbMemberCount: dbUsers.length,
        extrasInGoogle: extras.length,
        missingInGoogle: missing.length,
        removeJobsQueued: removeQueued,
        addJobsQueued: addQueued,
      })

      // Brief delay between groups
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (err) {
      results.push({
        groupEmail: normGroupEmail,
        googleMemberCount: -1,
        dbMemberCount: 0,
        extrasInGoogle: 0,
        missingInGoogle: 0,
        removeJobsQueued: 0,
        addJobsQueued: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  // Trigger processing of the queued jobs
  if (totalRemoveJobsQueued > 0 || totalAddJobsQueued > 0) {
    process.nextTick(() => triggerGoogleGroupSyncProcessing())
  }

  return { results, totalRemoveJobsQueued, totalAddJobsQueued }
}
