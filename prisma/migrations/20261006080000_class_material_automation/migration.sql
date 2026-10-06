-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "strictDriveAccess" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CourseAutomationConfig" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "notesFolderId" TEXT NOT NULL,
    "destinationTopicId" TEXT NOT NULL,
    "activationDate" TIMESTAMP(3) NOT NULL,
    "recordingWatermark" TIMESTAMP(3),
    "notesWatermark" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseAutomationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "phaseResults" JSONB,
    "counts" JSONB,
    "errorSummary" TEXT,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationLease" (
    "name" TEXT NOT NULL,
    "ownerRunId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "heartbeatAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationLease_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "ImportedSession" (
    "id" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "meetCode" TEXT NOT NULL,
    "notesKey" TEXT NOT NULL,
    "reviewState" TEXT NOT NULL DEFAULT 'MATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingImport" (
    "id" TEXT NOT NULL,
    "googleRecordingName" TEXT NOT NULL,
    "conferenceName" TEXT NOT NULL,
    "meetCode" TEXT NOT NULL,
    "driveFileId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "googleState" TEXT NOT NULL,
    "sessionId" TEXT,
    "contentId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "matchMethod" TEXT NOT NULL DEFAULT 'AUTOMATIC',
    "lastPublishedValues" JSONB,
    "fileModifiedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastValidatedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "RecordingImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteImport" (
    "id" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileModifiedAt" TIMESTAMP(3),
    "notesKey" TEXT,
    "sessionId" TEXT,
    "contentId" TEXT,
    "attachmentRole" TEXT,
    "primarySessionId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "matchMethod" TEXT NOT NULL DEFAULT 'AUTOMATIC',
    "lastPublishedValues" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastValidatedAt" TIMESTAMP(3),
    "attachedAt" TIMESTAMP(3),

    CONSTRAINT "NoteImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseAutomationConfig_courseId_key" ON "CourseAutomationConfig"("courseId");

-- CreateIndex
CREATE INDEX "AutomationRun_startedAt_idx" ON "AutomationRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedSession_sourceEventId_key" ON "ImportedSession"("sourceEventId");

-- CreateIndex
CREATE INDEX "ImportedSession_courseId_notesKey_idx" ON "ImportedSession"("courseId", "notesKey");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingImport_googleRecordingName_key" ON "RecordingImport"("googleRecordingName");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingImport_driveFileId_key" ON "RecordingImport"("driveFileId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingImport_contentId_key" ON "RecordingImport"("contentId");

-- CreateIndex
CREATE INDEX "RecordingImport_state_nextAttemptAt_idx" ON "RecordingImport"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "RecordingImport_sessionId_startTime_idx" ON "RecordingImport"("sessionId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "NoteImport_driveFileId_key" ON "NoteImport"("driveFileId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteImport_primarySessionId_key" ON "NoteImport"("primarySessionId");

-- CreateIndex
CREATE INDEX "NoteImport_courseId_state_idx" ON "NoteImport"("courseId", "state");

-- CreateIndex
CREATE INDEX "NoteImport_sessionId_idx" ON "NoteImport"("sessionId");


-- Keep a sentinel row so setup mutations and lease acquisition serialize even on the first run.
INSERT INTO "AutomationLease" ("name", "ownerRunId", "expiresAt", "heartbeatAt") VALUES ('class-material-import', '', '1970-01-01', '1970-01-01');
