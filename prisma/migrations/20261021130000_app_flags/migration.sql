CREATE TABLE IF NOT EXISTS "AppFlags" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "couponsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppFlags_pkey" PRIMARY KEY ("id")
);
INSERT INTO "AppFlags" ("id") VALUES ('singleton') ON CONFLICT ("id") DO NOTHING;
