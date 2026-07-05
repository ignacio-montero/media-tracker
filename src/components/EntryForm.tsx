"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EntryFormState } from "@/app/(app)/library/actions";
import { MEDIA_TYPES, ENTRY_STATUSES } from "@/lib/validation";

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

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={initial?.title ?? ""}
          className={inputClass}
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
            defaultValue={initial?.mediaType ?? "book"}
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
            defaultValue={initial?.creator ?? ""}
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
            defaultValue={initial?.year ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="genres" className={labelClass}>
          Genres <span className="text-neutral-400">(comma-separated)</span>
        </label>
        <input
          id="genres"
          name="genres"
          defaultValue={initial?.genres?.join(", ") ?? ""}
          placeholder="Sci-fi, Thriller"
          className={inputClass}
        />
      </div>

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

      <input type="hidden" name="externalId" value={initial?.externalId ?? ""} />

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
