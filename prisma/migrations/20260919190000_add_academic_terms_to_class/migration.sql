-- Add academicTerm, academicYear, and examCycle columns to Class (Course)
ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "academicTerm" TEXT;
ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "academicYear" INTEGER;
ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "examCycle" TEXT;
