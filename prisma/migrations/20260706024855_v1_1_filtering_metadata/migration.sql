-- CreateEnum
CREATE TYPE "AuthorGender" AS ENUM ('female', 'male', 'non_binary', 'mixed', 'unknown');

-- CreateEnum
CREATE TYPE "GenreCategory" AS ENUM ('fiction', 'non_fiction', 'other');

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "authorGender" "AuthorGender" NOT NULL DEFAULT 'unknown',
ADD COLUMN     "genreCategory" "GenreCategory",
ADD COLUMN     "metadataUnverified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subgenres" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Entry_userId_genreCategory_idx" ON "Entry"("userId", "genreCategory");

-- CreateIndex
CREATE INDEX "Entry_userId_authorGender_idx" ON "Entry"("userId", "authorGender");

-- CreateIndex
CREATE INDEX "Entry_userId_completedAt_idx" ON "Entry"("userId", "completedAt");
