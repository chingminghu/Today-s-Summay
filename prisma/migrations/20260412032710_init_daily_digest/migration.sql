-- CreateTable
CREATE TABLE "DailyDigest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "digestDate" TEXT NOT NULL,
    "dailySummary" TEXT NOT NULL,
    "generalSummary" TEXT NOT NULL,
    "sportsSummary" TEXT NOT NULL,
    "businessSummary" TEXT NOT NULL,
    "technologySummary" TEXT NOT NULL,
    "rawNewsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyDigest_digestDate_key" ON "DailyDigest"("digestDate");
