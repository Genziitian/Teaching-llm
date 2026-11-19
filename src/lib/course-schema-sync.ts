import { prisma } from '@/lib/db'

let ensurePromise: Promise<void> | null = null

export async function ensureCourseColumns() {
  if (ensurePromise) return ensurePromise
  ensurePromise = (async () => {
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Class"
          ADD COLUMN IF NOT EXISTS "academicTerm" TEXT,
          ADD COLUMN IF NOT EXISTS "academicYear" INTEGER,
          ADD COLUMN IF NOT EXISTS "examCycle" TEXT,
          ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT,
          ADD COLUMN IF NOT EXISTS "courseType" TEXT;
      `)
    } catch {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "academicTerm" TEXT;`)
      } catch {}
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "academicYear" INTEGER;`)
      } catch {}
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "examCycle" TEXT;`)
      } catch {}
    }
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT;`)
    } catch {}
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "courseType" TEXT;`)
    } catch {}
  })()
  return ensurePromise
}
