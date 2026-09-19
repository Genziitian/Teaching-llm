import { prisma } from '@/lib/db'

let courseColumnsEnsured = false

export async function ensureCourseColumns() {
  if (courseColumnsEnsured) return
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "academicTerm" TEXT;
      ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "academicYear" INTEGER;
      ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "examCycle" TEXT;
    `)
    courseColumnsEnsured = true
  } catch (e) {
    // If DB user has no ALTER TABLE permission or columns already exist
  }
}
