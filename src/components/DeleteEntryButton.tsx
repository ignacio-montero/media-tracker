"use client";

import { deleteEntryAction } from "@/app/(app)/library/actions";

/**
 * Delete button with a confirmation guard. Deleting an entry is irreversible,
 * so intercept the submit and ask before letting the server action run.
 */
export function DeleteEntryButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  return (
    <form
      action={deleteEntryAction}
      onSubmit={(e) => {
        if (!confirm(`Delete “${title}”? This can’t be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/40"
      >
        Delete
      </button>
    </form>
  );
}
