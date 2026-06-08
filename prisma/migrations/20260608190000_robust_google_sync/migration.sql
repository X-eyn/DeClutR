-- Durable Google sync state and run tracking.
ALTER TABLE "TemporalItem"
ADD COLUMN "googleTaskListId" TEXT,
ADD COLUMN "googleUpdatedAt" TIMESTAMP(3),
ADD COLUMN "googleDeletedAt" TIMESTAMP(3),
ADD COLUMN "syncOrigin" TEXT NOT NULL DEFAULT 'LOCAL';

CREATE TABLE "GoogleSyncState" (
  "userId" TEXT NOT NULL,
  "connected" BOOLEAN NOT NULL DEFAULT false,
  "tokenHealthy" BOOLEAN NOT NULL DEFAULT false,
  "reconnectRequired" BOOLEAN NOT NULL DEFAULT false,
  "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "lastSuccessfulImportAt" TIMESTAMP(3),
  "reconnectReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GoogleSyncState_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "SyncRun" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "counts" JSONB,
  "errorSummary" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SyncLog"
ADD COLUMN "syncRunId" TEXT;

CREATE INDEX "TemporalItem_userId_googleCalendarEventId_idx" ON "TemporalItem"("userId", "googleCalendarEventId");
CREATE INDEX "TemporalItem_userId_googleTaskId_idx" ON "TemporalItem"("userId", "googleTaskId");
CREATE INDEX "SyncRun_userId_createdAt_idx" ON "SyncRun"("userId", "createdAt");
CREATE INDEX "SyncRun_userId_status_idx" ON "SyncRun"("userId", "status");
CREATE INDEX "SyncLog_syncRunId_idx" ON "SyncLog"("syncRunId");

ALTER TABLE "GoogleSyncState"
ADD CONSTRAINT "GoogleSyncState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncRun"
ADD CONSTRAINT "SyncRun_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncLog"
ADD CONSTRAINT "SyncLog_syncRunId_fkey"
FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
