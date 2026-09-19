-- Persist academic terms in DB so manager deletes/edits survive deploys
CREATE TABLE IF NOT EXISTS "AcademicTermsConfig" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "terms" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicTermsConfig_pkey" PRIMARY KEY ("id")
);
