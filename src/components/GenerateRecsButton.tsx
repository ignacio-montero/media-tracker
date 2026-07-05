"use client";

import { useActionState } from "react";
import {
  generateRecommendationsAction,
  type RecsState,
} from "@/app/(app)/recommendations/actions";

export function GenerateRecsButton({ hasExisting }: { hasExisting: boolean }) {
  const [state, formAction, pending] = useActionState<RecsState, FormData>(
    generateRecommendationsAction,
    undefined,
  );

  return (
    <div className="flex flex-col items-start gap-2">
      <form action={formAction} className="flex flex-col items-start gap-3">
        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <input
            type="checkbox"
            name="fromList"
            className="h-4 w-4 rounded border-black/30 dark:border-white/30"
          />
          Only from the Greatest Books list (books I haven’t read)
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {pending
            ? "Thinking…"
            : hasExisting
              ? "Regenerate"
              : "Generate recommendations"}
        </button>
      </form>
      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      )}
    </div>
  );
}
