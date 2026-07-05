"use client";

import { useState, useActionState } from "react";
import Image from "next/image";
import type { SearchResult } from "@/lib/search/types";
import { MEDIA_ICONS } from "@/lib/display";
import {
  addFromSearchAction,
  type AddFromSearchState,
} from "@/app/(app)/library/search/actions";

const TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "book", label: "Books" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
] as const;

export function SearchClient() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [tmdbConfigured, setTmdbConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&type=${type}`,
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results as SearchResult[]);
      setTmdbConfigured(data.tmdbConfigured);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={runSearch} className="mb-4">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title…"
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
        <div className="mt-3 flex gap-2 text-sm">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`rounded-full px-3 py-1 transition ${
                type === t.value
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "border border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </form>

      {!tmdbConfigured && (type === "all" || type === "movie" || type === "tv") && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          TMDB isn’t configured yet — movie/TV results are unavailable until a
          <code className="mx-1">TMDB_API_KEY</code> is set. Book search works.
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {results && results.length === 0 && !loading && (
        <p className="text-neutral-500">No results found.</p>
      )}

      <ul className="space-y-3">
        {results?.map((r) => (
          <li
            key={`${r.source}-${r.externalId}`}
            className="flex gap-4 rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-neutral-900"
          >
            <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
              {r.imageUrl ? (
                <Image
                  src={r.imageUrl}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl">
                  {MEDIA_ICONS[r.mediaType]}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span aria-hidden>{MEDIA_ICONS[r.mediaType]}</span>
                <span className="font-medium">{r.title}</span>
                {r.year && (
                  <span className="text-sm text-neutral-400">({r.year})</span>
                )}
              </div>
              {r.creator && (
                <div className="text-sm text-neutral-500">{r.creator}</div>
              )}
              {r.genres.length > 0 && (
                <div className="mt-1 text-xs text-neutral-400">
                  {r.genres.join(", ")}
                </div>
              )}
              {r.overview && (
                <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {r.overview}
                </p>
              )}
            </div>
            <AddResultButton result={r} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddResultButton({ result }: { result: SearchResult }) {
  const [state, formAction, pending] = useActionState<
    AddFromSearchState,
    FormData
  >(addFromSearchAction, undefined);

  return (
    <form action={formAction} className="shrink-0 self-center">
      <input type="hidden" name="source" value={result.source} />
      <input type="hidden" name="externalId" value={result.externalId} />
      <input type="hidden" name="mediaType" value={result.mediaType} />
      <input type="hidden" name="title" value={result.title} />
      <input type="hidden" name="creator" value={result.creator ?? ""} />
      <input type="hidden" name="year" value={result.year ?? ""} />
      <input type="hidden" name="genres" value={JSON.stringify(result.genres)} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-black/15 px-3 py-1.5 text-sm transition hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
      >
        {pending ? "Adding…" : state?.error ? "Retry" : "+ Add"}
      </button>
    </form>
  );
}
