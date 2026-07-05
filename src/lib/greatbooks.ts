import { prisma } from "@/lib/prisma";
import { normalizeTitle } from "@/lib/normalize";

export type GreatBookCell = {
  rank: number;
  title: string;
  author: string;
  year: number | null;
  read: boolean;
};

export type GreatBooksProgress = {
  total: number;
  readCount: number;
  percent: number;
  books: GreatBookCell[];
  buckets: { label: string; read: number; total: number }[];
  readList: GreatBookCell[];
  nextUp: GreatBookCell[];
};

/**
 * Compute a user's progress against the "Greatest Books" list by matching
 * their logged book entries (any status) to the reference list on normalized
 * title.
 */
export async function getGreatBooksProgress(
  userId: string,
): Promise<GreatBooksProgress> {
  const [greatBooks, ownedBooks] = await Promise.all([
    prisma.greatBook.findMany({ orderBy: { rank: "asc" } }),
    prisma.entry.findMany({
      where: { userId, mediaType: "book" },
      select: { title: true },
    }),
  ]);

  const readSet = new Set(ownedBooks.map((b) => normalizeTitle(b.title)));

  const books: GreatBookCell[] = greatBooks.map((g) => ({
    rank: g.rank,
    title: g.title,
    author: g.author,
    year: g.year,
    read: readSet.has(g.normalizedTitle),
  }));

  const readCount = books.filter((b) => b.read).length;

  const buckets: GreatBooksProgress["buckets"] = [];
  for (let i = 0; i < books.length; i += 100) {
    const slice = books.filter((b) => b.rank > i && b.rank <= i + 100);
    buckets.push({
      label: `${i + 1}–${i + 100}`,
      read: slice.filter((b) => b.read).length,
      total: slice.length,
    });
  }

  return {
    total: books.length,
    readCount,
    percent: books.length
      ? Math.round((readCount / books.length) * 1000) / 10
      : 0,
    books,
    buckets,
    readList: books.filter((b) => b.read),
    nextUp: books.filter((b) => !b.read).slice(0, 10),
  };
}
