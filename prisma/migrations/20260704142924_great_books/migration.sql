-- CreateTable
CREATE TABLE "GreatBook" (
    "rank" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "year" INTEGER,
    "score" INTEGER,

    CONSTRAINT "GreatBook_pkey" PRIMARY KEY ("rank")
);

-- CreateIndex
CREATE INDEX "GreatBook_normalizedTitle_idx" ON "GreatBook"("normalizedTitle");
