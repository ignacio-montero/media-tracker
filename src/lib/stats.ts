import { prisma } from "@/lib/prisma";
import type { MediaType } from "@/generated/prisma/enums";

export type DashboardStats = {
  totals: { total: number; byType: Record<MediaType, number> };
  completedByType: Record<MediaType, number>;
  genreCounts: { genre: string; count: number }[];
  ratingDistribution: { rating: number; count: number }[];
  timeline: { month: string; book: number; tv: number; movie: number }[];
  timelineGranularity: "month" | "year";
  pace: { type: MediaType; perMonth: number }[];
  averageRating: number | null;
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
): Promise<DashboardStats> {
  const entries = await prisma.entry.findMany({
    where: { userId },
    select: {
      mediaType: true,
      status: true,
      rating: true,
      genres: true,
      completedAt: true,
    },
  });

  const byType = emptyByType();
  const completedByType = emptyByType();
  const genreMap = new Map<string, number>();
  const ratingCounts = [0, 0, 0, 0, 0]; // index 0 => rating 1
  const completions: { type: MediaType; date: Date }[] = [];
  let ratingSum = 0;
  let ratingN = 0;

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

  return {
    totals: { total: entries.length, byType },
    completedByType,
    genreCounts,
    ratingDistribution,
    timeline,
    timelineGranularity,
    pace,
    averageRating: ratingN > 0 ? Number((ratingSum / ratingN).toFixed(2)) : null,
  };
}
