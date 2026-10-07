import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Initializing Global Course ---')

  // 1. Find or create the manager who will "own" the global course (the first manager)
  const manager = await prisma.user.findFirst({
    where: { role: { in: ['MANAGER', 'ADMIN', 'MODERATOR'] } }
  })

  if (!manager) {
    console.error('No manager found to create global course. Please create a manager first.')
    return
  }

  // 2. Find or create the Global Course
  let globalCourse = await prisma.course.findFirst({
    where: { isGlobal: true }
  })

  if (!globalCourse) {
    globalCourse = await prisma.course.create({
      data: {
        id: 'LMS-COURSE-global', // Fixed ID for easy mapping
        name: 'Global System Course',
        description: 'Internal backend layer for global events and announcements.',
        subject: 'Global',
        createdById: manager.id,
        isGlobal: true,
      }
    })
    console.log(`Created Global Course with ID: ${globalCourse.id}`)
  } else {
    console.log(`Global Course already exists: ${globalCourse.id}`)
  }

  // 3. Enroll all existing users into the global course
  const allUsers = await prisma.user.findMany()
  console.log(`Found ${allUsers.length} users. Checking enrollments...`)

  let enrolled = 0
  for (const user of allUsers) {
    const existing = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: globalCourse.id
        }
      }
    })

    if (!existing) {
      await prisma.enrollment.create({
        data: {
          userId: user.id,
          courseId: globalCourse.id
        }
      })
      enrolled++
    }
  }

  console.log(`Enrolled ${enrolled} new users into the global course.`)
  console.log('--- Initialization Complete ---')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
