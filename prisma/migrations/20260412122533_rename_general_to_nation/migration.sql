/*
  Warnings:

  - You are about to drop the column `generalSummary` on the `DailyDigest` table. All the data in the column will be lost.
  - Added the required column `nationSummary` to the `DailyDigest` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyDigest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "digestDate" TEXT NOT NULL,
    "dailySummary" TEXT NOT NULL,
    "nationSummary" TEXT NOT NULL,
    "sportsSummary" TEXT NOT NULL,
    "businessSummary" TEXT NOT NULL,
    "technologySummary" TEXT NOT NULL,
    "rawNewsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_DailyDigest" ("businessSummary", "createdAt", "dailySummary", "digestDate", "id", "rawNewsJson", "sportsSummary", "technologySummary", "updatedAt") SELECT "businessSummary", "createdAt", "dailySummary", "digestDate", "id", "rawNewsJson", "sportsSummary", "technologySummary", "updatedAt" FROM "DailyDigest";
DROP TABLE "DailyDigest";
ALTER TABLE "new_DailyDigest" RENAME TO "DailyDigest";
CREATE UNIQUE INDEX "DailyDigest_digestDate_key" ON "DailyDigest"("digestDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
