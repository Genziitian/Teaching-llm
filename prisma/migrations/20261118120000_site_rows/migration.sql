-- Former website database tables, stored as JSON rows in the platform database.
CREATE TABLE IF NOT EXISTS "SiteRow" (
    "tableName" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteRow_pkey" PRIMARY KEY ("tableName", "rowKey")
);

CREATE INDEX IF NOT EXISTS "SiteRow_tableName_idx" ON "SiteRow"("tableName");
-- Lookups by email are the most common filter on these tables.
CREATE INDEX IF NOT EXISTS "SiteRow_email_idx" ON "SiteRow"("tableName", (lower("data"->>'email')));
