import { prisma } from '@/lib/db'

let ensurePromise: Promise<void> | null = null

export async function ensureHomeworkTables() {
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    try {
      // 1. Create Homework table if not exists
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Homework" (
          "id" TEXT NOT NULL,
          "classId" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "fileUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "dueAt" TIMESTAMP(3) NOT NULL,
          "isOpen" BOOLEAN NOT NULL DEFAULT true,
          "createdById" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Homework_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "Homework_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Homework_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
      `)

      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Homework" ADD COLUMN IF NOT EXISTS "isOpen" BOOLEAN NOT NULL DEFAULT true;`)
      } catch (_) {}

      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Homework_classId_idx" ON "Homework"("classId");`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Homework_dueAt_idx" ON "Homework"("dueAt");`)

      // 2. Create HomeworkSubmission table if not exists
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

      try {
        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "HomeworkSubmission_homeworkId_studentId_key" ON "HomeworkSubmission"("homeworkId", "studentId");`)
      } catch (_) {}

      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HomeworkSubmission_homeworkId_idx" ON "HomeworkSubmission"("homeworkId");`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId");`)
    } catch (e: any) {
      console.error('[SCHEMA SYNC] ensureHomeworkTables error:', e?.message || e)
      ensurePromise = null // allow retry on next request if it failed
      throw e
    }
  })()

  return ensurePromise
}
