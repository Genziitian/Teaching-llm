import {
  NOTIFICATION_MEMBERS_PER_GROUP,
  poolIndexToSerialRange,
  serialToPoolIndex,
} from '@/lib/notification-group-constants'

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function parseNotificationGroupEmails(emailsStr?: string | null): string[] {
  if (!emailsStr) return []
  return Array.from(
    new Set(
      emailsStr
        .split(',')
        .map(e => normalizeEmail(e))
        .filter(Boolean)
    )
  )
}

export function validateNotificationGroupEmail(groupEmail: string): string {
  const normalized = normalizeEmail(groupEmail)
  if (!normalized || !normalized.includes('@')) {
    throw new Error(`Invalid group email address: ${groupEmail}`)
  }
  return normalized
}

/** Default Google Group capacity for notification mail assigner (not course groups). */
export const DEFAULT_MEMBERS_PER_GROUP = NOTIFICATION_MEMBERS_PER_GROUP

export async function queueNotificationGroupSyncJob(
  db: any,
  {
    userEmail,
    groupEmail,
    action = 'ADD',
    force = false,
  }: {
    userEmail: string
    groupEmail: string
    action?: 'ADD' | 'REMOVE'
    /** When true, ignore prior SUCCESS jobs so we can re-sync after a wipe/reassign. */
    force?: boolean
  }
) {
  const normUserEmail = normalizeEmail(userEmail)
  const normGroupEmail = normalizeEmail(groupEmail)

  // Dedup: without force, SUCCESS also blocks re-queue (avoids spam clicks).
  // With force (mail assigner wipe), only PENDING/PROCESSING block duplicates.
  const existingJob = await db.groupSyncJob.findFirst({
    where: {
      userEmail: normUserEmail,
      groupEmail: normGroupEmail,
      action,
      status: { in: force ? ['PENDING', 'PROCESSING'] : ['PENDING', 'PROCESSING', 'SUCCESS'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (existingJob) return existingJob

  return await db.groupSyncJob.create({
    data: {
      userEmail: normUserEmail,
      groupEmail: normGroupEmail,
      action,
      groupType: 'NOTIFICATION',
      status: 'PENDING',
      attemptCount: 0,
    },
  })
}

/**
 * Ensure a default Pool Category exists (e.g. "General Announcements")
 */
export async function ensureDefaultPoolCategory(db: any) {
  let defaultCategory = await db.notificationPoolCategory.findFirst({
    where: { isDefault: true },
  })

  if (!defaultCategory) {
    defaultCategory = await db.notificationPoolCategory.findFirst({
      orderBy: { createdAt: 'asc' },
    })
  }

  if (!defaultCategory) {
    defaultCategory = await db.notificationPoolCategory.create({
      data: {
        name: 'General Announcements',
        description: 'Default pool for system-wide student notifications',
        isDefault: true,
      },
    })
  }

  return defaultCategory
}

/**
 * Create a new Named Pool Category
 */
export async function createPoolCategory(db: any, name: string, description?: string, isDefault = false) {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Pool Category Name is required')

  if (isDefault) {
    await db.notificationPoolCategory.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    })
  }

  return await db.notificationPoolCategory.create({
    data: {
      name: trimmedName,
      description: description ? description.trim() : null,
      isDefault,
    },
  })
}

/**
 * Add a new Google Group email to a specific Pool Category, and immediately flush waiting users
 */
export async function addEmailToPoolCategory(
  db: any,
  categoryId: string,
  groupEmail: string,
  maxCapacity = 700
) {
  const validatedEmail = validateNotificationGroupEmail(groupEmail)

  const category = await db.notificationPoolCategory.findUnique({
    where: { id: categoryId },
  })
  if (!category) throw new Error('Pool Category not found')

  let poolEmail = await db.notificationPoolEmail.findUnique({
    where: { groupEmail: validatedEmail },
  })

  if (poolEmail) {
    poolEmail = await db.notificationPoolEmail.update({
      where: { id: poolEmail.id },
      data: { categoryId: category.id, isActive: true, maxCapacity },
    })
  } else {
    poolEmail = await db.notificationPoolEmail.create({
      data: {
        groupEmail: validatedEmail,
        categoryId: category.id,
        maxCapacity,
        currentCount: 0,
        isActive: true,
      },
    })
  }

  // Immediately flush queue for this category
  const flushResult = await flushCategoryOverflowQueue(db, category.id)

  return { poolEmail, category, flushResult }
}

/**
 * Assign a user to a Pool Category (finding/rolling over to an available child email)
 */
export async function getOrAssignPoolCategory(db: any, userEmail: string, categoryId?: string) {
  const normUserEmail = normalizeEmail(userEmail)

  const targetUser = await db.user.findUnique({
    where: { email: normUserEmail },
    select: { id: true, email: true, notificationGroupEmails: true, pendingPoolCategoryIds: true },
  })

  if (!targetUser) throw new Error(`User not found with email: ${userEmail}`)

  let targetCategory: any
  if (categoryId) {
    targetCategory = await db.notificationPoolCategory.findUnique({
      where: { id: categoryId },
    })
  } else {
    targetCategory = await ensureDefaultPoolCategory(db)
  }

  if (!targetCategory) return { assigned: false, pending: true }

  // Find active email in this category with space
  const poolEmails = await db.notificationPoolEmail.findMany({
    where: { categoryId: targetCategory.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  // CHECK: If user ALREADY has an email belonging to this category, DO NOT assign a second email from the same category!
  const categoryEmailAddresses = poolEmails.map(p => p.groupEmail)
  const currentGroups = parseNotificationGroupEmails(targetUser.notificationGroupEmails)
  const existingCategoryEmail = currentGroups.find(email => categoryEmailAddresses.includes(email))

  if (existingCategoryEmail) {
    return {
      assigned: true,
      groupEmail: existingCategoryEmail,
      categoryName: targetCategory.name,
      newlyAssigned: false,
    }
  }

  let availableEmail: any = null
  for (const p of poolEmails) {
    const actualCount = await db.user.count({
      where: { notificationGroupEmails: { contains: p.groupEmail } },
    })
    if (actualCount < p.maxCapacity) {
      availableEmail = p
      break
    }
  }

  // If no email with capacity exists in this category
  if (!availableEmail) {
    const pendingCatIds = parseNotificationGroupEmails(targetUser.pendingPoolCategoryIds)
    if (!pendingCatIds.includes(targetCategory.id)) {
      const updatedPending = Array.from(new Set([...pendingCatIds, targetCategory.id]))
      await db.user.update({
        where: { id: targetUser.id },
        data: {
          isNotificationGroupPending: true,
          pendingPoolCategoryIds: updatedPending.join(','),
        },
      })
    }
    return { assigned: false, pending: true, categoryName: targetCategory.name }
  }

  // Assign user to availableEmail.groupEmail
  if (!currentGroups.includes(availableEmail.groupEmail)) {
    const updatedGroups = Array.from(new Set([...currentGroups, availableEmail.groupEmail]))

    // Remove category from pending list if present
    const pendingCatIds = parseNotificationGroupEmails(targetUser.pendingPoolCategoryIds).filter(
      id => id !== targetCategory.id
    )

    await db.user.update({
      where: { id: targetUser.id },
      data: {
        notificationGroupEmails: updatedGroups.join(','),
        pendingPoolCategoryIds: pendingCatIds.join(','),
        isNotificationGroupPending: pendingCatIds.length > 0,
      },
    })

    // Update pool email count
    const actualCount = await db.user.count({
      where: { notificationGroupEmails: { contains: availableEmail.groupEmail } },
    })
    await db.notificationPoolEmail.update({
      where: { id: availableEmail.id },
      data: { currentCount: actualCount },
    })

    // Queue Google Sync ADD job
    await queueNotificationGroupSyncJob(db, {
      userEmail: targetUser.email,
      groupEmail: availableEmail.groupEmail,
      action: 'ADD',
    })

    return {
      assigned: true,
      groupEmail: availableEmail.groupEmail,
      categoryName: targetCategory.name,
      newlyAssigned: true,
    }
  }

  return { assigned: true, groupEmail: availableEmail.groupEmail, categoryName: targetCategory.name, newlyAssigned: false }
}

/**
 * Flush category overflow queue
 */
export async function flushCategoryOverflowQueue(db: any, categoryId: string) {
  const pendingUsers = await db.user.findMany({
    where: {
      pendingPoolCategoryIds: { contains: categoryId },
    },
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  })

  if (pendingUsers.length === 0) {
    return { totalPending: 0, assigned: 0 }
  }

  let assignedCount = 0
  for (const user of pendingUsers) {
    const res = await getOrAssignPoolCategory(db, user.email, categoryId)
    if (res.assigned && res.newlyAssigned) {
      assignedCount++
    } else if (res.pending) {
      break // filled up again
    }
  }

  return { totalPending: pendingUsers.length, assigned: assignedCount }
}

/**
 * Bulk assign ALL users or unassigned users to a Pool Category
 */
// In-memory guard to prevent concurrent bulk assignment runs from creating duplicate jobs
let _bulkAssignRunning = false

export async function assignAllUsersToPoolCategory(db: any, categoryId?: string) {
  // Prevent concurrent runs (e.g. user clicking button 4 times, or auto-sync overlapping)
  if (_bulkAssignRunning) {
    return { count: 0, categoryName: '', message: 'Bulk assignment already in progress. Please wait.' }
  }
  _bulkAssignRunning = true

  try {
    let targetCategory: any
    if (categoryId) {
      targetCategory = await db.notificationPoolCategory.findUnique({
        where: { id: categoryId },
      })
    } else {
      targetCategory = await ensureDefaultPoolCategory(db)
    }

    if (!targetCategory) throw new Error('Pool Category not found')

    const poolEmails = await db.notificationPoolEmail.findMany({
      where: { categoryId: targetCategory.id, isActive: true },
    })

    if (poolEmails.length === 0) {
      return { count: 0, categoryName: targetCategory.name, message: `No active pool emails in ${targetCategory.name}` }
    }

    const categoryEmailAddresses = poolEmails.map(p => p.groupEmail)

    // Find users who do NOT have an email belonging to this pool category
    const unassignedUsers = await db.user.findMany({
      where: {
        OR: [
          { notificationGroupEmails: null },
          { notificationGroupEmails: '' },
          {
            NOT: {
              OR: categoryEmailAddresses.map(addr => ({
                notificationGroupEmails: { contains: addr },
              })),
            },
          },
        ],
      },
      select: { id: true, email: true },
      orderBy: { createdAt: 'asc' },
    })

    let count = 0
    // Track processed user emails to prevent double-processing within same run
    const processedEmails = new Set<string>()

    for (const user of unassignedUsers) {
      const normEmail = normalizeEmail(user.email)
      if (processedEmails.has(normEmail)) continue
      processedEmails.add(normEmail)

      const res = await getOrAssignPoolCategory(db, user.email, targetCategory.id)
      if (res.assigned && res.newlyAssigned) {
        count++
      } else if (res.pending) {
        // Pool filled up to capacity, stop loop immediately!
        break
      }
    }

    return { count, categoryName: targetCategory.name, message: `Processed assignment for ${count} users in ${targetCategory.name}` }
  } finally {
    _bulkAssignRunning = false
  }
}

/**
 * Comprehensive Stats for Visualizer Dashboard
 */
export async function getPoolCategoryStats(db: any) {
  await ensureDefaultPoolCategory(db)

  const categories = await db.notificationPoolCategory.findMany({
    include: {
      emails: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Compute LIVE counts from User table instead of reading stale currentCount.
  // Also sync the live count back to DB so it stays accurate.
  const updatedCategories = []
  for (const cat of categories) {
    const updatedEmails = []
    for (const email of cat.emails) {
      // Live count: actually count users who have this group email
      const liveCount = await db.user.count({
        where: { notificationGroupEmails: { contains: email.groupEmail } },
      })

      // Sync back to DB if drifted (self-healing)
      if (liveCount !== email.currentCount) {
        await db.notificationPoolEmail.update({
          where: { id: email.id },
          data: { currentCount: liveCount },
        })
      }

      updatedEmails.push({
        ...email,
        currentCount: liveCount,
        percentage: Math.min(100, Math.round((liveCount / email.maxCapacity) * 100)),
        isFull: liveCount >= email.maxCapacity,
      })
    }

    const totalCap = updatedEmails.reduce((sum: number, e: any) => sum + (e.isActive ? e.maxCapacity : 0), 0)
    const totalAssigned = updatedEmails.reduce((sum: number, e: any) => sum + (e.isActive ? e.currentCount : 0), 0)

    updatedCategories.push({
      ...cat,
      emails: updatedEmails,
      totalCapacity: totalCap,
      totalAssigned,
      pendingCount: 0,
    })
  }

  const totalAssignedUsersCount = await db.user.count({
    where: {
      AND: [
        { notificationGroupEmails: { not: null } },
        { NOT: { notificationGroupEmails: '' } },
      ],
    },
  })

  const totalUnassignedUsersCount = await db.user.count({
    where: {
      OR: [
        { notificationGroupEmails: null },
        { notificationGroupEmails: '' },
      ],
    },
  })

  const totalUsersCount = totalAssignedUsersCount + totalUnassignedUsersCount
  const predictedGroupsNeeded = Math.ceil(totalUnassignedUsersCount / DEFAULT_MEMBERS_PER_GROUP)

  return {
    categories: updatedCategories,
    totalPendingGlobal: 0,
    totalUsersCount,
    totalAssignedUsersCount,
    totalUnassignedUsersCount,
    predictedGroupsNeeded,
  }
}

/**
 * Clean up duplicate pool assignments so each user has AT MOST 1 email per Pool Category
 */
export async function cleanupDuplicatePoolAssignments(db: any) {
  // Get all categories and their child pool email addresses
  const categories = await db.notificationPoolCategory.findMany({
    include: { emails: true },
  })

  // Target only users who have multiple emails (comma separated)
  const users = await db.user.findMany({
    where: {
      notificationGroupEmails: { contains: ',' },
    },
    select: { id: true, email: true, notificationGroupEmails: true },
  })

  let cleanedCount = 0

  for (const user of users) {
    const userEmails = parseNotificationGroupEmails(user.notificationGroupEmails)
    const cleanedEmails: string[] = []
    let modified = false

    // Track assigned categories for this user
    const assignedCategoryIds = new Set<string>()

    const removedEmails: string[] = []

    for (const email of userEmails) {
      // Find category for this email
      const matchedCategory = categories.find(c => c.emails.some(e => e.groupEmail === email))
      if (matchedCategory) {
        if (!assignedCategoryIds.has(matchedCategory.id)) {
          assignedCategoryIds.add(matchedCategory.id)
          cleanedEmails.push(email)
        } else {
          // Duplicate email in same pool category! Drop it & track for Google REMOVE sync!
          removedEmails.push(email)
          modified = true
        }
      } else {
        // Custom email not in any pool category, keep it
        cleanedEmails.push(email)
      }
    }

    if (modified) {
      await db.user.update({
        where: { id: user.id },
        data: {
          notificationGroupEmails: cleanedEmails.join(','),
        },
      })

      // Queue REMOVE sync job for each dropped duplicate so Google Workspace removes them from Google Group
      for (const removedEmail of removedEmails) {
        await db.groupSyncJob.create({
          data: {
            userEmail: user.email,
            groupEmail: removedEmail,
            action: 'REMOVE',
            status: 'PENDING',
          },
        })
      }

      cleanedCount++
    }
  }

  // Recalculate currentCount for all pool emails
  const allPoolEmails = await db.notificationPoolEmail.findMany()
  for (const email of allPoolEmails) {
    const actualCount = await db.user.count({
      where: { notificationGroupEmails: { contains: email.groupEmail } },
    })
    await db.notificationPoolEmail.update({
      where: { id: email.id },
      data: { currentCount: actualCount },
    })
  }

  // Automatically auto-distribute remaining unassigned users using optimized auto-distribution
  const defaultCategory = await ensureDefaultPoolCategory(db)
  await assignAllUsersToPoolCategory(db, defaultCategory.id)

  return { cleanedCount, message: `Cleaned duplicate pool emails for ${cleanedCount} users and auto-distributed.` }
}

/**
 * NUCLEAR RESET: Clear ALL notification pool assignments, redistribute every user
 * from scratch (500 per group), and queue smart Google sync jobs.
 * 
 * This handles the scenario where Google Groups are already overfilled/out of sync.
 * 
 * Steps:
 * 1. Clear ALL users' notificationGroupEmails
 * 2. Reset all pool email counts to 0
 * 3. Delete all pending NOTIFICATION sync jobs (clean slate)
 * 4. Re-assign every user to exactly 1 group (500 per group, sequential)
 * 5. Queue ADD sync job for each assignment
 * 
 * After this runs, run "Reconcile with Google" to remove extras from Google Groups.
 */
export async function fullResetAndRedistribute(db: any, categoryId?: string) {
  let targetCategory: any
  if (categoryId) {
    targetCategory = await db.notificationPoolCategory.findUnique({
      where: { id: categoryId },
    })
  } else {
    targetCategory = await ensureDefaultPoolCategory(db)
  }

  if (!targetCategory) throw new Error('Pool Category not found')

  const poolEmails = await db.notificationPoolEmail.findMany({
    where: { categoryId: targetCategory.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  if (poolEmails.length === 0) {
    throw new Error(`No active pool emails in "${targetCategory.name}". Add group emails first.`)
  }

  // ─── Step 1: Clear ALL users' notification group emails ─────────────
  const categoryEmailAddresses = poolEmails.map((p: any) => p.groupEmail)
  
  // Get ALL users who have any notification group email from this category
  const usersWithAssignment = await db.user.findMany({
    where: {
      AND: [
        { notificationGroupEmails: { not: null } },
        { NOT: { notificationGroupEmails: '' } },
      ],
    },
    select: { id: true, email: true, notificationGroupEmails: true },
  })

  // For each user, remove only the emails belonging to THIS category (preserve other categories)
  let clearedCount = 0
  for (const user of usersWithAssignment) {
    const currentEmails = parseNotificationGroupEmails(user.notificationGroupEmails)
    const remainingEmails = currentEmails.filter(e => !categoryEmailAddresses.includes(e))
    
    if (remainingEmails.length !== currentEmails.length) {
      await db.user.update({
        where: { id: user.id },
        data: {
          notificationGroupEmails: remainingEmails.length > 0 ? remainingEmails.join(',') : null,
          isNotificationGroupPending: false,
          pendingPoolCategoryIds: null,
        },
      })
      clearedCount++
    }
  }

  // ─── Step 2: Reset all pool email counts to 0 ──────────────────────
  for (const poolEmail of poolEmails) {
    await db.notificationPoolEmail.update({
      where: { id: poolEmail.id },
      data: { currentCount: 0 },
    })
  }

  // ─── Step 3: Delete all pending NOTIFICATION sync jobs for these groups ─
  await db.groupSyncJob.deleteMany({
    where: {
      groupEmail: { in: categoryEmailAddresses },
      groupType: 'NOTIFICATION',
      status: { in: ['PENDING', 'PROCESSING'] },
    },
  })

  // ─── Step 4: Get ALL users and assign them fresh ───────────────────
  const allUsers = await db.user.findMany({
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  })

  let assignedCount = 0
  let poolIndex = 0
  let currentPoolCount = 0

  for (const user of allUsers) {
    // Find next pool email with space
    while (poolIndex < poolEmails.length && currentPoolCount >= poolEmails[poolIndex].maxCapacity) {
      // Save count for current pool and move to next
      await db.notificationPoolEmail.update({
        where: { id: poolEmails[poolIndex].id },
        data: { currentCount: currentPoolCount },
      })
      poolIndex++
      currentPoolCount = 0
    }

    if (poolIndex >= poolEmails.length) {
      // All pools are full — mark remaining users as pending
      break
    }

    const targetPoolEmail = poolEmails[poolIndex]
    const normEmail = normalizeEmail(user.email)

    // Read user's current emails (might have other categories)
    const freshUser = await db.user.findUnique({
      where: { id: user.id },
      select: { notificationGroupEmails: true },
    })
    const existingEmails = parseNotificationGroupEmails(freshUser?.notificationGroupEmails)
    
    // Skip if user already has this pool email (shouldn't happen after reset, but safe)
    if (existingEmails.includes(targetPoolEmail.groupEmail)) continue

    const updatedEmails = [...existingEmails, targetPoolEmail.groupEmail]

    await db.user.update({
      where: { id: user.id },
      data: {
        notificationGroupEmails: updatedEmails.join(','),
        isNotificationGroupPending: false,
        pendingPoolCategoryIds: null,
      },
    })

    // Queue ADD sync job (dedup will prevent true duplicates)
    await queueNotificationGroupSyncJob(db, {
      userEmail: normEmail,
      groupEmail: targetPoolEmail.groupEmail,
      action: 'ADD',
    })

    currentPoolCount++
    assignedCount++
  }

  // Save final pool count
  if (poolIndex < poolEmails.length) {
    await db.notificationPoolEmail.update({
      where: { id: poolEmails[poolIndex].id },
      data: { currentCount: currentPoolCount },
    })
  }

  // Mark remaining users as pending if pools ran out of space
  const remainingUnassigned = allUsers.length - assignedCount

  return {
    totalUsers: allUsers.length,
    assignedCount,
    clearedCount,
    remainingUnassigned,
    poolsUsed: Math.min(poolIndex + 1, poolEmails.length),
    categoryName: targetCategory.name,
    message: `Full reset complete: cleared ${clearedCount} old assignments, re-assigned ${assignedCount} users across ${Math.min(poolIndex + 1, poolEmails.length)} pool emails in "${targetCategory.name}".${remainingUnassigned > 0 ? ` ${remainingUnassigned} users still need groups (add more pool emails).` : ''}`,
  }
}

/**
 * Mail Assigner step 1: remove ALL notification-pool members (DB + queue REMOVE jobs).
 * Does not touch course Google Groups. After this, run serial assign to add back one-by-one.
 */
export async function removeAllNotificationPoolMembers(db: any, categoryId?: string) {
  let targetCategory: any
  if (categoryId) {
    targetCategory = await db.notificationPoolCategory.findUnique({
      where: { id: categoryId },
    })
  } else {
    targetCategory = await ensureDefaultPoolCategory(db)
  }

  if (!targetCategory) throw new Error('Pool Category not found')

  const poolEmails = await db.notificationPoolEmail.findMany({
    where: { categoryId: targetCategory.id },
    orderBy: { createdAt: 'asc' },
  })

  if (poolEmails.length === 0) {
    throw new Error(
      `No pool emails in "${targetCategory.name}". Add Google Group emails first.`
    )
  }

  const categoryEmailAddresses: string[] = poolEmails.map((p: any) => p.groupEmail)
  const categoryEmailSet = new Set(categoryEmailAddresses)

  await db.groupSyncJob.deleteMany({
    where: {
      groupEmail: { in: categoryEmailAddresses },
      groupType: 'NOTIFICATION',
      status: { in: ['PENDING', 'PROCESSING'] },
    },
  })

  const usersWithAssignment = await db.user.findMany({
    where: {
      AND: [
        { notificationGroupEmails: { not: null } },
        { NOT: { notificationGroupEmails: '' } },
      ],
    },
    select: { id: true, email: true, notificationGroupEmails: true },
  })

  let clearedUsers = 0
  let removeJobsQueued = 0

  for (const user of usersWithAssignment) {
    const currentEmails = parseNotificationGroupEmails(user.notificationGroupEmails)
    const oldCategoryEmails = currentEmails.filter(e => categoryEmailSet.has(e))
    if (oldCategoryEmails.length === 0) continue

    const remainingEmails = currentEmails.filter(e => !categoryEmailSet.has(e))
    const normUserEmail = normalizeEmail(user.email)

    for (const oldEmail of oldCategoryEmails) {
      await queueNotificationGroupSyncJob(db, {
        userEmail: normUserEmail,
        groupEmail: oldEmail,
        action: 'REMOVE',
        force: true,
      })
      removeJobsQueued++
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        notificationGroupEmails: remainingEmails.length > 0 ? remainingEmails.join(',') : null,
        notificationGroupSerial: null,
        isNotificationGroupPending: false,
        pendingPoolCategoryIds: null,
      },
    })
    clearedUsers++
  }

  for (const poolEmail of poolEmails) {
    await db.notificationPoolEmail.update({
      where: { id: poolEmail.id },
      data: { currentCount: 0, maxCapacity: DEFAULT_MEMBERS_PER_GROUP },
    })
  }

  return {
    categoryId: targetCategory.id,
    categoryName: targetCategory.name,
    clearedUsers,
    removeJobsQueued,
    poolEmails: categoryEmailAddresses,
    message: `Removed notification group assignments for ${clearedUsers} users (${removeJobsQueued} REMOVE jobs queued) in "${targetCategory.name}". Process Google Sync, then run serial assign to add members one-by-one. Course mails untouched.`,
  }
}

/**
 * Mail Assigner step 2: assign serials 1..N and queue ADD (700/group, fixed).
 * Prefer running REMOVE_ALL first so groups are empty, then this adds one-by-one via sync jobs.
 * Never touches course Google Groups (groupType COURSE).
 */
export async function serialResetAndAssign(
  db: any,
  {
    categoryId,
  }: {
    categoryId?: string
  } = {}
) {
  const capacity = DEFAULT_MEMBERS_PER_GROUP

  let targetCategory: any
  if (categoryId) {
    targetCategory = await db.notificationPoolCategory.findUnique({
      where: { id: categoryId },
    })
  } else {
    targetCategory = await ensureDefaultPoolCategory(db)
  }

  if (!targetCategory) throw new Error('Pool Category not found')

  let poolEmails = await db.notificationPoolEmail.findMany({
    where: { categoryId: targetCategory.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  if (poolEmails.length === 0) {
    throw new Error(
      `No active pool emails in "${targetCategory.name}". Add Google Group emails to the pool first.`
    )
  }

  for (const poolEmail of poolEmails) {
    if (poolEmail.maxCapacity !== capacity) {
      await db.notificationPoolEmail.update({
        where: { id: poolEmail.id },
        data: { maxCapacity: capacity },
      })
    }
  }
  poolEmails = poolEmails.map((p: any) => ({ ...p, maxCapacity: capacity }))

  const categoryEmailAddresses: string[] = poolEmails.map((p: any) => p.groupEmail)
  const categoryEmailSet = new Set(categoryEmailAddresses)

  const allUsers = await db.user.findMany({
    select: { id: true, email: true, notificationGroupEmails: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  const poolsNeeded = Math.ceil(allUsers.length / capacity) || 1
  if (poolsNeeded > poolEmails.length) {
    throw new Error(
      `Need ${poolsNeeded} pool group emails for ${allUsers.length} users at ${capacity}/group, but only ${poolEmails.length} active. Add more group emails first.`
    )
  }

  await db.groupSyncJob.deleteMany({
    where: {
      groupEmail: { in: categoryEmailAddresses },
      groupType: 'NOTIFICATION',
      status: { in: ['PENDING', 'PROCESSING'] },
      action: 'ADD',
    },
  })

  let addJobsQueued = 0
  let alreadyHadAssignment = 0
  let unchangedCount = 0
  const poolCounts = new Array(poolEmails.length).fill(0)
  const serialPreview: Array<{
    serial: number
    email: string
    groupEmail: string
  }> = []

  for (let i = 0; i < allUsers.length; i++) {
    const user = allUsers[i]
    const serial = i + 1
    const poolIndex = Math.floor((serial - 1) / capacity)
    const targetPoolEmail = poolEmails[poolIndex]
    const newGroupEmail = targetPoolEmail.groupEmail as string
    const normUserEmail = normalizeEmail(user.email)
    const currentEmails = parseNotificationGroupEmails(user.notificationGroupEmails)
    const oldCategoryEmails = currentEmails.filter(e => categoryEmailSet.has(e))
    const otherEmails = currentEmails.filter(e => !categoryEmailSet.has(e))
    const alreadyInTarget = oldCategoryEmails.includes(newGroupEmail)

    if (oldCategoryEmails.length > 0) alreadyHadAssignment++

    // If still assigned somewhere in this category, move: REMOVE old ≠ new
    for (const oldEmail of oldCategoryEmails) {
      if (oldEmail === newGroupEmail) continue
      await queueNotificationGroupSyncJob(db, {
        userEmail: normUserEmail,
        groupEmail: oldEmail,
        action: 'REMOVE',
        force: true,
      })
    }

    const updatedEmails = [...otherEmails, newGroupEmail]

    await db.user.update({
      where: { id: user.id },
      data: {
        notificationGroupEmails: updatedEmails.join(','),
        notificationGroupSerial: serial,
        isNotificationGroupPending: false,
        pendingPoolCategoryIds: null,
      },
    })

    // "Already added" = DB already had this exact group email (we trust DB;
    // use Reconcile to verify Google membership).
    if (alreadyInTarget) {
      unchangedCount++
    } else {
      await queueNotificationGroupSyncJob(db, {
        userEmail: normUserEmail,
        groupEmail: newGroupEmail,
        action: 'ADD',
        force: true,
      })
      addJobsQueued++
    }

    poolCounts[poolIndex]++

    if (serialPreview.length < 20) {
      serialPreview.push({
        serial,
        email: normUserEmail,
        groupEmail: newGroupEmail,
      })
    }
  }

  for (let i = 0; i < poolEmails.length; i++) {
    await db.notificationPoolEmail.update({
      where: { id: poolEmails[i].id },
      data: { currentCount: poolCounts[i], maxCapacity: capacity },
    })
  }

  const poolsUsed = poolCounts.filter(c => c > 0).length
  const distribution = poolEmails.map((p: any, i: number) => ({
    groupEmail: p.groupEmail,
    groupNumber: i + 1,
    serialFrom: poolCounts[i] > 0 ? i * capacity + 1 : null,
    serialTo: poolCounts[i] > 0 ? i * capacity + poolCounts[i] : null,
    memberCount: poolCounts[i],
    maxCapacity: capacity,
  }))

  return {
    totalUsers: allUsers.length,
    assignedCount: allUsers.length,
    alreadyHadAssignment,
    unchangedCount,
    addJobsQueued,
    membersPerGroup: capacity,
    poolsUsed,
    poolsAvailable: poolEmails.length,
    categoryName: targetCategory.name,
    categoryId: targetCategory.id,
    distribution,
    serialPreview,
    message: `Serials 1–${allUsers.length} assigned. Group 1 = #1–#${Math.min(capacity, allUsers.length)}${allUsers.length > capacity ? `; Group 2 = #${capacity + 1}–#${Math.min(capacity * 2, allUsers.length)}` : ''}${allUsers.length > capacity * 2 ? '; …' : ''}. Queued ${addJobsQueued} ADD jobs. Course mails untouched.`,
  }
}
