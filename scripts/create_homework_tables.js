const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Creating Homework tables if not exist...')
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Homework" (
        "id" TEXT NOT NULL,
        "classId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "fileUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
        "dueAt" TIMESTAMP(3) NOT NULL,
        "createdById" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Homework_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Homework_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Homework_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `)
    console.log('Homework table ensured.')

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Homework_classId_idx" ON "Homework"("classId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Homework_dueAt_idx" ON "Homework"("dueAt");`)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "HomeworkSubmission" (
        "id" TEXT NOT NULL,
        "homeworkId" TEXT NOT NULL,
        "studentId" TEXT NOT NULL,
        "fileUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
        "note" TEXT,
        "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `)
    console.log('HomeworkSubmission table ensured.')

    try {
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "HomeworkSubmission_homeworkId_studentId_key" ON "HomeworkSubmission"("homeworkId", "studentId");`)
    } catch (e) {
      console.log('Unique index warning:', e.message)
    }

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HomeworkSubmission_homeworkId_idx" ON "HomeworkSubmission"("homeworkId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId");`)

    console.log('All homework tables & indexes created successfully!')
  } catch (error) {
    console.error('Error creating homework tables:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
