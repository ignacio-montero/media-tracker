import { prisma } from "@/lib/prisma";
import type { MediaType, AuthorGender, GenreCategory } from "@/generated/prisma/enums";
import { type EntryFilters, buildEntryWhere } from "@/lib/filters";
import { GENDER_VALUES, CATEGORY_LABELS } from "@/lib/taxonomy";

export type DashboardStats = {
  totals: { total: number; byType: Record<MediaType, number> };
  completedByType: Record<MediaType, number>;
  genreCounts: { genre: string; count: number }[];
  ratingDistribution: { rating: number; count: number }[];
  timeline: { month: string; book: number; tv: number; movie: number }[];
  timelineGranularity: "month" | "year";
  pace: { type: MediaType; perMonth: number }[];
  averageRating: number | null;
  // v1.1 book breakdowns (see docs/ARCHITECTURE.md).
  genderSplit: { gender: AuthorGender; count: number }[];
  categorySplit: { category: GenreCategory; label: string; count: number }[];
  topSubgenres: { subgenre: string; count: number }[];
  byPublicationDecade: { decade: string; count: number }[];
};

const MEDIA: MediaType[] = ["book", "tv", "movie"];

function emptyByType(): Record<MediaType, number> {
  return { book: 0, tv: 0, movie: 0 };
}

/** Format a Date to a YYYY-MM month key (UTC). */
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Inclusive list of month keys spanning [start, end]. */
function monthRange(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= last) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

export async function getDashboardStats(
  userId: string,
  filters: EntryFilters = {},
): Promise<DashboardStats> {
  const entries = await prisma.entry.findMany({
    where: buildEntryWhere(userId, filters),
    select: {
      mediaType: true,
      status: true,
      rating: true,
      genres: true,
      completedAt: true,
      authorGender: true,
      genreCategory: true,
      subgenres: true,
      year: true,
    },
  });

  const byType = emptyByType();
  const completedByType = emptyByType();
  const genreMap = new Map<string, number>();
  const ratingCounts = [0, 0, 0, 0, 0]; // index 0 => rating 1
  const completions: { type: MediaType; date: Date }[] = [];
  let ratingSum = 0;
  let ratingN = 0;

  // Book-only breakdowns.
  const genderCounts = new Map<AuthorGender, number>(
    GENDER_VALUES.map((g) => [g, 0]),
  );
  const categoryCounts = new Map<GenreCategory, number>();
  const subgenreCounts = new Map<string, number>();
  const decadeCounts = new Map<string, number>();

  for (const e of entries) {
    byType[e.mediaType]++;
    for (const g of e.genres) {
      genreMap.set(g, (genreMap.get(g) ?? 0) + 1);
    }
    if (e.status === "completed") {
      completedByType[e.mediaType]++;
      if (e.completedAt) completions.push({ type: e.mediaType, date: e.completedAt });
    }
    if (e.rating && e.rating >= 1 && e.rating <= 5) {
      ratingCounts[e.rating - 1]++;
      ratingSum += e.rating;
      ratingN++;
    }

    if (e.mediaType === "book") {
      genderCounts.set(e.authorGender, (genderCounts.get(e.authorGender) ?? 0) + 1);
      if (e.genreCategory) {
        categoryCounts.set(
          e.genreCategory,
          (categoryCounts.get(e.genreCategory) ?? 0) + 1,
        );
      }
      for (const s of e.subgenres) {
        subgenreCounts.set(s, (subgenreCounts.get(s) ?? 0) + 1);
      }
      if (e.year) {
        const decade = `${Math.floor(e.year / 10) * 10}s`;
        decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
      }
    }
  }

  const genreCounts = [...genreMap.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const ratingDistribution = ratingCounts.map((count, i) => ({
    rating: i + 1,
    count,
  }));

  // --- Timeline: completion buckets by type. Monthly for short histories,
  // yearly once the span exceeds ~2 years so the axis stays readable. ---
  let timeline: DashboardStats["timeline"] = [];
  let timelineGranularity: "month" | "year" = "month";
  if (completions.length > 0) {
    const dates = completions.map((c) => c.date);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime()), Date.now()));
    const buckets = new Map<string, { book: number; tv: number; movie: number }>();

    if (monthRange(min, max).length > 24) {
      timelineGranularity = "year";
      const startY = min.getUTCFullYear();
      const endY = Math.max(max.getUTCFullYear(), new Date().getUTCFullYear());
      for (let y = startY; y <= endY; y++) {
        buckets.set(String(y), { book: 0, tv: 0, movie: 0 });
      }
      for (const c of completions) {
        const b = buckets.get(String(c.date.getUTCFullYear()));
        if (b) b[c.type]++;
      }
    } else {
      for (const key of monthRange(min, max)) {
        buckets.set(key, { book: 0, tv: 0, movie: 0 });
      }
      for (const c of completions) {
        const b = buckets.get(monthKey(c.date));
        if (b) b[c.type]++;
      }
    }
    timeline = [...buckets.entries()].map(([month, v]) => ({ month, ...v }));
  }

  // --- Pace: avg completions per active month, per type ---
  const pace = MEDIA.map((type) => {
    const typeCompletions = completions.filter((c) => c.type === type);
    if (typeCompletions.length === 0) return { type, perMonth: 0 };
    const earliest = Math.min(...typeCompletions.map((c) => c.date.getTime()));
    const monthsActive = Math.max(
      1,
      monthRange(new Date(earliest), new Date()).length,
    );
    return {
      type,
      perMonth: Number((typeCompletions.length / monthsActive).toFixed(2)),
    };
  });

  const genderSplit = GENDER_VALUES.map((gender) => ({
    gender,
    count: genderCounts.get(gender) ?? 0,
  }));

  const categorySplit = [...categoryCounts.entries()]
    .map(([category, count]) => ({
      category,
      label: CATEGORY_LABELS[category],
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const topSubgenres = [...subgenreCounts.entries()]
    .map(([subgenre, count]) => ({ subgenre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const byPublicationDecade = [...decadeCounts.entries()]
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => parseInt(a.decade, 10) - parseInt(b.decade, 10));

  return {
    totals: { total: entries.length, byType },
    completedByType,
    genreCounts,
    ratingDistribution,
    timeline,
    timelineGranularity,
    pace,
    averageRating: ratingN > 0 ? Number((ratingSum / ratingN).toFixed(2)) : null,
    genderSplit,
    categorySplit,
    topSubgenres,
    byPublicationDecade,
  };
}
