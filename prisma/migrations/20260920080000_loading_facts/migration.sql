-- Manager-editable loading facts shown on loading screens.
CREATE TABLE IF NOT EXISTS "LoadingFact" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "text" TEXT NOT NULL,
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "isCoupon" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadingFact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoadingFact_code_key" ON "LoadingFact"("code");
CREATE INDEX IF NOT EXISTS "LoadingFact_rarity_idx" ON "LoadingFact"("rarity");
CREATE INDEX IF NOT EXISTS "LoadingFact_isActive_idx" ON "LoadingFact"("isActive");
CREATE INDEX IF NOT EXISTS "LoadingFact_createdAt_idx" ON "LoadingFact"("createdAt");
