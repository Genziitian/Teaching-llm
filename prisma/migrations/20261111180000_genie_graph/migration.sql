-- Genie editable question/answer graph (new tables only, nothing existing is touched)
CREATE TABLE IF NOT EXISTS "GenieNode" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'menu',
  "questionEn" TEXT,
  "questionHi" TEXT,
  "answerEn" TEXT,
  "answerHi" TEXT,
  "linkLabelEn" TEXT,
  "linkLabelHi" TEXT,
  "linkHref" TEXT,
  "needsAgent" BOOLEAN NOT NULL DEFAULT false,
  "ticketType" TEXT,
  "x" DOUBLE PRECISION,
  "y" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GenieNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GenieOption" (
  "id" TEXT NOT NULL,
  "fromId" TEXT NOT NULL,
  "toId" TEXT NOT NULL,
  "labelEn" TEXT NOT NULL,
  "labelHi" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "GenieOption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GenieOption_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "GenieNode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GenieOption_toId_fkey" FOREIGN KEY ("toId") REFERENCES "GenieNode"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "GenieOption_fromId_toId_key" ON "GenieOption"("fromId", "toId");
CREATE INDEX IF NOT EXISTS "GenieOption_fromId_idx" ON "GenieOption"("fromId");
CREATE INDEX IF NOT EXISTS "GenieOption_toId_idx" ON "GenieOption"("toId");
