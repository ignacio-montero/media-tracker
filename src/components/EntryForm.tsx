"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import type { EntryFormState } from "@/app/(app)/library/actions";
import { MEDIA_TYPES, ENTRY_STATUSES } from "@/lib/validation";
import {
  CATEGORY_LABELS,
  GENDER_VALUES,
  GENDER_LABELS,
  subgenresFor,
  type GenreCategory,
} from "@/lib/taxonomy";
import { TitleAutocomplete } from "@/components/TitleAutocomplete";
import type { SearchResult } from "@/lib/search/types";

export type EntryFormValues = {
  title?: string;
  mediaType?: string;
  externalId?: string;
  creator?: string;
  year?: number | null;
  genres?: string[];
  status?: string;
  rating?: number | null;
  notes?: string | null;
  completedAt?: string | null; // YYYY-MM-DD
  // v1.1 — books-only metadata
  authorGender?: string | null;
  genreCategory?: string | null;
  subgenres?: string[];
};

const MEDIA_LABELS: Record<string, string> = {
  book: "Book",
  tv: "TV show",
  movie: "Movie",
};

const STATUS_LABELS: Record<string, string> = {
  want: "Want to consume",
  in_progress: "In progress",
  completed: "Completed",
  dropped: "Dropped",
};

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40";
const labelClass = "mb-1 block text-sm font-medium";

export function EntryForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: EntryFormState, formData: FormData) => Promise<EntryFormState>;
  initial?: EntryFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<EntryFormState, FormData>(
    action,
    undefined,
  );

  const [mediaType, setMediaType] = useState(initial?.mediaType ?? "book");
  const [genreCategory, setGenreCategory] = useState(
    initial?.genreCategory ?? "",
  );
  const [subgenres, setSubgenres] = useState<string[]>(
    initial?.subgenres ?? [],
  );

  // Lifted controlled state for the fields autocomplete selection can autofill.
  const [title, setTitle] = useState(initial?.title ?? "");
  const [creator, setCreator] = useState(initial?.creator ?? "");
  const [year, setYear] = useState(initial?.year ?? "");
  const [genres, setGenres] = useState(initial?.genres?.join(", ") ?? "");
  const [externalId, setExternalId] = useState(initial?.externalId ?? "");

  // Guards against a stale creatorFor enrichment fetch landing after a newer
  // selection/edit.
  const enrichmentIdRef = useRef(0);

  const isBook = mediaType === "book";
  const subgenreOptions = genreCategory
    ? subgenresFor(genreCategory as GenreCategory)
    : [];

  const toggleSubgenre = (s: string) => {
    setSubgenres((prev) =>
      prev.includes(s) ? prev.filter((v) => v !== s) : [...prev, s],
    );
  };

  // Editing the title by hand after a selection means it no longer refers to
  // that specific external work.
  // Any newer selection OR manual edit must invalidate an in-flight creator
  // enrichment, so a late director fetch can't clobber fresher data.
  function invalidateEnrichment() {
    enrichmentIdRef.current++;
  }

  function handleTitleChange(next: string) {
    invalidateEnrichment();
    setTitle(next);
    if (externalId) setExternalId("");
  }

  function handleMediaTypeChange(next: string) {
    invalidateEnrichment();
    setMediaType(next);
    // A media-type switch invalidates any external match too.
    if (externalId) setExternalId("");
  }

  function handleSelect(result: SearchResult) {
    // Bump the enrichment id for EVERY selection (not just the enriching
    // branch) so a prior movie/TV director fetch can't land on this result.
    const requestId = ++enrichmentIdRef.current;
    setTitle(result.title);
    if (result.creator) setCreator(result.creator);
    if (result.year !== undefined) setYear(result.year);
    setGenres(result.genres.join(", "));
    setExternalId(result.externalId);

    // Movie/TV results carry no creator — best-effort enrichment via the
    // creatorFor lookup. Ignore failures; the field stays user-editable.
    if (!result.creator && (result.mediaType === "movie" || result.mediaType === "tv")) {
      fetch(`/api/search?creatorFor=${encodeURIComponent(result.externalId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { creator: string | null } | null) => {
          if (requestId !== enrichmentIdRef.current) return; // stale
          if (data?.creator) setCreator(data.creator);
        })
        .catch(() => {
          // Best-effort only — leave Creator as-is on failure.
        });
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <TitleAutocomplete
          id="title"
          name="title"
          required
          mediaType={mediaType}
          author={creator}
          value={title}
          onChange={handleTitleChange}
          onSelect={handleSelect}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="mediaType" className={labelClass}>
            Type
          </label>
          <select
            id="mediaType"
            name="mediaType"
            value={mediaType}
            onChange={(e) => handleMediaTypeChange(e.target.value)}
            className={inputClass}
          >
            {MEDIA_TYPES.map((t) => (
              <option key={t} value={t}>
                {MEDIA_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "want"}
            className={inputClass}
          >
            {ENTRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="creator" className={labelClass}>
            Creator <span className="text-neutral-400">(author / director)</span>
          </label>
          <input
            id="creator"
            name="creator"
            value={creator}
            onChange={(e) => {
              invalidateEnrichment();
              setCreator(e.target.value);
            }}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="year" className={labelClass}>
            Year
          </label>
          <input
            id="year"
            name="year"
            type="number"
            min={0}
            max={3000}
            value={year}
            onChange={(e) =>
              setYear(e.target.value === "" ? "" : Number(e.target.value))
            }
            className={inputClass}
          />
        </div>
      </div>

      {isBook ? (
        <div className="space-y-4 rounded-lg border border-black/10 p-3 dark:border-white/10">
          <p className="text-xs text-neutral-400">
            Book metadata — used for filtering & dashboard breakdowns.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="authorGender" className={labelClass}>
                Author gender
              </label>
              <select
                id="authorGender"
                name="authorGender"
                defaultValue={initial?.authorGender ?? "unknown"}
                className={inputClass}
              >
                {GENDER_VALUES.map((g) => (
                  <option key={g} value={g}>
                    {GENDER_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="genreCategory" className={labelClass}>
                Category
              </label>
              <select
                id="genreCategory"
                name="genreCategory"
                value={genreCategory}
                onChange={(e) => {
                  setGenreCategory(e.target.value);
                  setSubgenres([]);
                }}
                className={inputClass}
              >
                <option value="">Uncategorized</option>
                {(Object.keys(CATEGORY_LABELS) as GenreCategory[]).map(
                  (c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          {subgenreOptions.length > 0 && (
            <div>
              <span className={labelClass}>Subgenres</span>
              <div className="flex flex-wrap gap-2">
                {subgenreOptions.map((s) => {
                  const active = subgenres.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSubgenre(s)}
                      className={`rounded-full px-3 py-1 text-sm transition ${
                        active
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                          : "border border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              {/* Mirror selection into hidden inputs so it submits with the form */}
              {subgenres.map((s) => (
                <input key={s} type="hidden" name="subgenres" value={s} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <label htmlFor="genres" className={labelClass}>
            Genres <span className="text-neutral-400">(comma-separated)</span>
          </label>
          <input
            id="genres"
            name="genres"
            value={genres}
            onChange={(e) => setGenres(e.target.value)}
            placeholder="Sci-fi, Thriller"
            className={inputClass}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="rating" className={labelClass}>
            Rating <span className="text-neutral-400">(1–5)</span>
          </label>
          <select
            id="rating"
            name="rating"
            defaultValue={initial?.rating ?? ""}
            className={inputClass}
          >
            <option value="">No rating</option>
            {[1, 2, 3, 4, 5].map((r) => (
              <option key={r} value={r}>
                {"★".repeat(r)} ({r})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="completedAt" className={labelClass}>
            Date read <span className="text-neutral-400">(if completed)</span>
          </label>
          <input
            id="completedAt"
            name="completedAt"
            type="date"
            defaultValue={initial?.completedAt ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initial?.notes ?? ""}
          className={inputClass}
        />
      </div>

      <input type="hidden" name="externalId" value={externalId} />

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/library"
          className="rounded-lg border border-black/15 px-4 py-2 text-sm transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
