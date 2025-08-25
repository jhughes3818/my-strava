-- CreateTable
CREATE TABLE "public"."SyncState" (
    "userId" TEXT NOT NULL,
    "lastSyncStart" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "backfillDone" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "public"."SyncState" ADD CONSTRAINT "SyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
