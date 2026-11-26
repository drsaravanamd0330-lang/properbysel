-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "lastAlertedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");
