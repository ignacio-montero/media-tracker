"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { SearchResult } from "@/lib/search/types";
import { MEDIA_ICONS } from "@/lib/display";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40";

type Status = "idle" | "loading" | "loaded" | "error";

export function TitleAutocomplete({
  mediaType,
  author,
  value,
  onChange,
  onSelect,
  id = "title",
  name = "title",
  required,
}: {
  mediaType: string;
  author: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: SearchResult) => void;
  id?: string;
  name?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [tmdbConfigured, setTmdbConfigured] = useState(true);
  const [highlight, setHighlight] = useState(-1);
  // Suppress reopening the dropdown right after a selection, until the user
  // types again. This affects render output (whether the list can show), so
  // it lives in state rather than a ref.
  const [suppressed, setSuppressed] = useState(false);

  // Monotonic request id so a late/out-of-order response can never render
  // over a newer one.
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didMountRef = useRef(false);
  const listId = `${id}-listbox`;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function scheduleSearch(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.trim().length < MIN_CHARS) {
      abortRef.current?.abort();
      setStatus("idle");
      setResults([]);
      setOpen(false);
      return;
    }

    // User is typing again after a selection — re-arm normal behavior.
    setSuppressed(false);

    debounceRef.current = setTimeout(() => {
      runSearch(q);
    }, DEBOUNCE_MS);
  }

  async function runSearch(q: string) {
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setOpen(true);

    const params = new URLSearchParams({ q, type: mediaType });
    if (mediaType === "book" && author.trim()) {
      params.set("author", author.trim());
    }

    try {
      const res = await fetch(`/api/search?${params.toString()}`, {
        signal: controller.signal,
      });
      if (requestId !== requestIdRef.current) return; // stale
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      if (requestId !== requestIdRef.current) return; // stale (double guard)
      setResults(data.results as SearchResult[]);
      setTmdbConfigured(Boolean(data.tmdbConfigured));
      setStatus("loaded");
      setHighlight(-1);
    } catch (err) {
      if (requestId !== requestIdRef.current) return; // stale, ignore abort/error
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("error");
      setResults([]);
    }
  }

  // Re-scope book suggestions when the Creator field changes while a title is
  // already being searched (e.g. the user types the title first, then the
  // author). Skipped after a selection so autofilling Creator doesn't reopen
  // the dropdown. runSearch is deferred via setTimeout, so no synchronous
  // setState-in-effect.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (suppressed || mediaType !== "book" || value.trim().length < MIN_CHARS) {
      return;
    }
    const t = setTimeout(() => runSearch(value), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // Intentionally keyed on `author` only — we re-query when the scoping
    // author changes, using the current title/mediaType at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    onChange(next);
    scheduleSearch(next);
  }

  function selectResult(result: SearchResult) {
    setSuppressed(true);
    requestIdRef.current++; // invalidate any in-flight request
    abortRef.current?.abort();
    setOpen(false);
    setResults([]);
    setStatus("idle");
    setHighlight(-1);
    onSelect(result);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? results.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      // The dropdown is open with results — Enter picks a suggestion (the
      // highlighted one, else the first) instead of submitting the form with
      // an unselected, externalId-less entry.
      e.preventDefault();
      const pick =
        highlight >= 0 && highlight < results.length
          ? results[highlight]
          : results[0];
      selectResult(pick);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    }
  }

  function handleFocus() {
    if (suppressed) return;
    if (value.trim().length >= MIN_CHARS && results.length > 0) {
      setOpen(true);
    }
  }

  function handleBlur() {
    // Defer closing so a click on an option registers before we hide the list.
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 150);
  }

  const showDropdown = open && !suppressed;
  const activeId =
    highlight >= 0 && highlight < results.length
      ? `${id}-option-${highlight}`
      : undefined;

  const noTmdb =
    !tmdbConfigured && (mediaType === "movie" || mediaType === "tv");

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        autoComplete="off"
        required={required}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={inputClass}
      />

      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-black/15 bg-white text-sm shadow-lg dark:border-white/15 dark:bg-neutral-900"
        >
          {status === "loading" && (
            <li className="px-3 py-2 text-neutral-400">Searching…</li>
          )}

          {status === "error" && (
            <li className="px-3 py-2 text-red-600 dark:text-red-400">
              Something went wrong. Please try again.
            </li>
          )}

          {status === "loaded" && noTmdb && results.length === 0 && (
            <li className="px-3 py-2 text-amber-700 dark:text-amber-400">
              TMDB isn’t configured — movie/TV autocomplete is unavailable.
            </li>
          )}

          {status === "loaded" && !noTmdb && results.length === 0 && (
            <li className="px-3 py-2 text-neutral-400">No matches</li>
          )}

          {status === "loaded" &&
            results.map((r, i) => (
              <li
                key={`${r.source}-${r.externalId}`}
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={highlight === i}
                onMouseDown={(e) => {
                  // Prevent input blur from firing before the click is handled.
                  e.preventDefault();
                }}
                onClick={() => selectResult(r)}
                onMouseEnter={() => setHighlight(i)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                  highlight === i
                    ? "bg-black/5 dark:bg-white/10"
                    : ""
                }`}
              >
                <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
                  {r.imageUrl ? (
                    <Image
                      src={r.imageUrl}
                      alt=""
                      fill
                      sizes="32px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-base">
                      {MEDIA_ICONS[r.mediaType]}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.title}</div>
                  <div className="truncate text-xs text-neutral-500">
                    {[r.creator, r.year].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
