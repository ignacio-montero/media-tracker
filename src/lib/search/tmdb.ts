import type { SearchResult } from "./types";
import type { MediaType } from "@/generated/prisma/enums";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w185";

export class TmdbNotConfiguredError extends Error {
  constructor() {
    super("TMDB_API_KEY is not set");
    this.name = "TmdbNotConfiguredError";
  }
}

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new TmdbNotConfiguredError();
  return key;
}

async function tmdbFetch<T>(path: string, params: Record<string, string>) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB request failed (${res.status})`);
  return (await res.json()) as T;
}

// --- Genre id → name maps, fetched once and cached in-process ---
type GenreList = { genres: { id: number; name: string }[] };
let genreCache: { movie: Map<number, string>; tv: Map<number, string> } | null =
  null;

async function getGenreMaps() {
  if (genreCache) return genreCache;
  const [movie, tv] = await Promise.all([
    tmdbFetch<GenreList>("/genre/movie/list", {}),
    tmdbFetch<GenreList>("/genre/tv/list", {}),
  ]);
  genreCache = {
    movie: new Map(movie.genres.map((g) => [g.id, g.name])),
    tv: new Map(tv.genres.map((g) => [g.id, g.name])),
  };
  return genreCache;
}

type MultiResult = {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  poster_path?: string | null;
  overview?: string;
};

type MultiResponse = { results: MultiResult[] };

function yearFrom(date?: string): number | undefined {
  if (!date) return undefined;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) ? y : undefined;
}

/** Search TMDB for movies and TV shows. Requires TMDB_API_KEY. */
export async function searchTmdb(query: string): Promise<SearchResult[]> {
  const [data, genres] = await Promise.all([
    tmdbFetch<MultiResponse>("/search/multi", { query }),
    getGenreMaps(),
  ]);

  return (data.results ?? [])
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 12)
    .map((r) => {
      const mediaType: MediaType = r.media_type === "movie" ? "movie" : "tv";
      const map = r.media_type === "movie" ? genres.movie : genres.tv;
      return {
        source: "tmdb" as const,
        externalId: `${r.media_type}:${r.id}`,
        mediaType,
        title: r.title ?? r.name ?? "Untitled",
        year: yearFrom(r.release_date ?? r.first_air_date),
        genres: (r.genre_ids ?? [])
          .map((id) => map.get(id))
          .filter((g): g is string => Boolean(g)),
        imageUrl: r.poster_path ? `${IMG_BASE}${r.poster_path}` : undefined,
        overview: r.overview || undefined,
      };
    });
}

type MovieDetails = {
  credits?: { crew?: { job: string; name: string }[] };
};
type TvDetails = {
  created_by?: { name: string }[];
};

/**
 * Fetch the "creator" for an item on add:
 * director for movies, first creator for TV. Best-effort — returns undefined
 * if unavailable. externalId format is "movie:123" / "tv:456".
 */
export async function getTmdbCreator(
  externalId: string,
): Promise<string | undefined> {
  const [kind, id] = externalId.split(":");
  if (!id) return undefined;

  if (kind === "movie") {
    const d = await tmdbFetch<MovieDetails>(`/movie/${id}`, {
      append_to_response: "credits",
    });
    return d.credits?.crew?.find((c) => c.job === "Director")?.name;
  }
  if (kind === "tv") {
    const d = await tmdbFetch<TvDetails>(`/tv/${id}`, {});
    return d.created_by?.[0]?.name;
  }
  return undefined;
}
