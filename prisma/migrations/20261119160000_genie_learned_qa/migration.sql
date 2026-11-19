-- GenZie community learning queue (manager-approved Q&A used for community auto-replies).
CREATE TABLE IF NOT EXISTS "GenieLearnedQA" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'STAFF_REPLY',
    "courseId" TEXT,
    "questionMessageId" TEXT,
    "answerMessageId" TEXT,
    "askedById" TEXT,
    "answeredById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GenieLearnedQA_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GenieLearnedQA_answerMessageId_key" ON "GenieLearnedQA"("answerMessageId");
CREATE INDEX IF NOT EXISTS "GenieLearnedQA_status_idx" ON "GenieLearnedQA"("status");
