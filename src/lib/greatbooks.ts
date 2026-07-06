import { prisma } from "@/lib/prisma";
import { normalizeTitle } from "@/lib/normalize";

export type GreatBookCell = {
  rank: number;
  title: string;
  author: string;
  year: number | null;
  read: boolean;
};

/** A "Next up" pick: an unread list book plus a short why-this reason. */
export type GreatBookRec = GreatBookCell & { reason: string };

/** The user's own logged books, used to infer taste for "Next up" ranking. */
export type LibraryBook = {
  creator: string | null;
  rating: number | null;
  year: number | null;
};

export type GreatBooksProgress = {
  total: number;
  readCount: number;
  percent: number;
  books: GreatBookCell[];
  buckets: { label: string; read: number; total: number }[];
  readList: GreatBookCell[];
  nextUp: GreatBookRec[];
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
      select: { title: true, creator: true, rating: true, year: true },
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
    nextUp: rankNextUp(
      books.filter((b) => !b.read),
      ownedBooks,
      books.length,
    ),
  };
}

// --- "Next up" taste ranking (pure, unit-tested in tests/greatbooks.test.ts) ---

/** Lowercase, strip accents/punctuation, collapse whitespace — for loose name
 * matching between the user's library and the reference list. */
function normAuthor(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD") // decompose accents so the strip below drops the marks
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** First listed author only — drops co-authors/translators so a library
 * `creator` like "Leo Tolstoy, Louise Maude" keys on Tolstoy, not the
 * translator. */
function primaryAuthor(s: string): string {
  return s.split(/[,;&/]| and | with /i)[0]!.trim();
}

/** A loose author key: first initial + surname (e.g. "z smith"). Tolerates
 * "Zadie Smith" vs "Z. Smith" while keeping distinct given names with a shared
 * surname apart ("z smith" ≠ "b smith"). Assumes given-name-first ordering
 * (true for both our data sources). Returns "" only when there's no usable
 * surname. NOTE: this is a coarse *grouping* key — the reason text asserts a
 * specific author only when the key maps to a single distinct name (see
 * rankNextUp), so key collisions never produce a false "you've read N by X". */
function authorKey(s: string): string {
  const parts = normAuthor(primaryAuthor(s)).split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  const surname = parts[parts.length - 1];
  if (surname.length < 2) return "";
  return `${parts[0][0]} ${surname}`;
}

const decadeOf = (year: number) => Math.floor(year / 10) * 10;

/**
 * Rank unread list books by how well they fit the user's demonstrated taste:
 *  - author affinity  (books they've read by the same author, boosted if rated highly)
 *  - era affinity      (how much they read from that book's publication decade)
 *  - acclaim prior     (list rank — small, mainly a tiebreaker + cold-start fallback)
 * Cold start (no library) collapses to acclaim order, i.e. the old behavior.
 */
export function rankNextUp(
  unread: GreatBookCell[],
  library: LibraryBook[],
  total: number,
  limit = 10,
): GreatBookRec[] {
  // Build taste signals from the library. Each author key tracks the distinct
  // normalized names that mapped to it, so we only assert "you've read N by X"
  // when the key is unambiguous (one real person under it).
  type NameStat = { count: number; ratings: number[] };
  const byAuthor = new Map<string, { total: number; names: Map<string, NameStat> }>();
  const decadeCounts = new Map<number, number>();
  let decadeMax = 0;

  for (const b of library) {
    if (b.creator) {
      const key = authorKey(b.creator);
      if (key) {
        const rec = byAuthor.get(key) ?? { total: 0, names: new Map() };
        rec.total++;
        const nName = normAuthor(primaryAuthor(b.creator));
        const nameStat = rec.names.get(nName) ?? { count: 0, ratings: [] };
        nameStat.count++;
        if (b.rating) nameStat.ratings.push(b.rating);
        rec.names.set(nName, nameStat);
        byAuthor.set(key, rec);
      }
    }
    if (b.year) {
      const d = decadeOf(b.year);
      const c = (decadeCounts.get(d) ?? 0) + 1;
      decadeCounts.set(d, c);
      if (c > decadeMax) decadeMax = c;
    }
  }

  const scored = unread.map((g) => {
    // Author affinity — trustworthy only when the key resolves to this exact
    // name, or to a single distinct name (a spelling/format variant of it).
    // Otherwise (a genuine initial+surname collision) we grant no author credit
    // and don't claim a count, so the reason never misattributes reads.
    const key = authorKey(g.author);
    const rec = key ? byAuthor.get(key) : undefined;
    const exact = rec?.names.get(normAuthor(primaryAuthor(g.author)));
    const stat = exact ?? (rec && rec.names.size === 1
      ? [...rec.names.values()][0]
      : undefined);
    const authorCount = stat?.count ?? 0;
    const avgRating = stat?.ratings.length
      ? stat.ratings.reduce((s, r) => s + r, 0) / stat.ratings.length
      : 0;
    const authorAffinity =
      authorCount > 0
        ? Math.min(
            1,
            0.55 + 0.15 * Math.min(authorCount, 3) + (avgRating >= 4 ? 0.2 : 0),
          )
        : 0;

    // Era affinity: share of the user's reading in this book's decade,
    // normalized so their most-read decade scores 1.
    const eraAffinity =
      g.year && decadeMax > 0
        ? (decadeCounts.get(decadeOf(g.year)) ?? 0) / decadeMax
        : 0;

    // Acclaim prior: rank 1 ≈ 1, rank `total` ≈ 0.
    const acclaim = total > 0 ? (total - g.rank + 1) / total : 0;

    const score = 3 * authorAffinity + eraAffinity + 0.5 * acclaim;

    let reason: string;
    if (authorCount > 0) {
      reason =
        authorCount === 1
          ? `Another by ${g.author}, whom you've read`
          : `You've read ${authorCount} by ${g.author}`;
      if (avgRating >= 4) reason += " and rated highly";
    } else if (eraAffinity >= 0.5 && g.year) {
      reason = `Fits your ${decadeOf(g.year)}s reading`;
    } else {
      reason = `Acclaimed — #${g.rank} on the list`;
    }

    return { rec: { ...g, reason }, score };
  });

  scored.sort((a, b) => b.score - a.score || a.rec.rank - b.rec.rank);
  return scored.slice(0, limit).map((s) => s.rec);
}
