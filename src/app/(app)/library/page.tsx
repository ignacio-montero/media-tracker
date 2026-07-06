import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  MEDIA_ICONS,
  STATUS_BADGE,
  STATUS_LABELS,
  stars,
} from "@/lib/display";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { FilterBar } from "@/components/FilterBar";
import { parseEntryFilters, getLibraryEntries } from "@/lib/filters";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const filters = parseEntryFilters(sp);
  const entries = await getLibraryEntries(user.id, filters);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Library</h1>
        <div className="flex gap-2">
          <Link
            href="/library/search"
            className="rounded-lg border border-black/15 px-3 py-2 text-sm transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            Search & add
          </Link>
          <Link
            href="/library/new"
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            + Add manually
          </Link>
        </div>
      </div>

      <FilterBar
        value={{
          type: filters.type,
          status: filters.status,
          readYear: filters.readYear,
          readMonth: filters.readMonth,
          pubFrom: filters.pubFrom,
          pubTo: filters.pubTo,
          gender: filters.gender,
          category: filters.category,
          subgenres: filters.subgenres,
          unverified: filters.unverified,
        }}
      />

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-neutral-500 dark:border-white/15">
          Nothing here yet.{" "}
          <Link href="/library/search" className="font-medium underline">
            Search
          </Link>{" "}
          or{" "}
          <Link href="/library/new" className="font-medium underline">
            add an entry
          </Link>{" "}
          to get started.
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden>{MEDIA_ICONS[e.mediaType]}</span>
                  <span className="font-medium">{e.title}</span>
                  {e.year && (
                    <span className="text-sm text-neutral-400">({e.year})</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[e.status]}`}
                  >
                    {STATUS_LABELS[e.status]}
                  </span>
                  {e.metadataUnverified && (
                    <span
                      title="AI-suggested metadata, not yet confirmed"
                      className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                    >
                      Unverified
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-neutral-500">
                  {e.creator && <span>{e.creator}</span>}
                  {e.creator && e.genres.length > 0 && <span> · </span>}
                  {e.genres.length > 0 && <span>{e.genres.join(", ")}</span>}
                  {e.creator &&
                    e.genres.length === 0 &&
                    e.subgenres.length > 0 && <span> · </span>}
                  {e.subgenres.length > 0 && (
                    <span>{e.subgenres.join(", ")}</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                  {e.rating && (
                    <span className="text-amber-500">{stars(e.rating)}</span>
                  )}
                  {e.completedAt && (
                    <span className="text-neutral-400">
                      Read{" "}
                      {e.completedAt.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                      })}
                    </span>
                  )}
                </div>
                {e.notes && (
                  <p className="mt-2 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {e.notes}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/library/${e.id}/edit`}
                  className="rounded-lg border border-black/15 px-3 py-1.5 text-sm transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  Edit
                </Link>
                <DeleteEntryButton id={e.id} title={e.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
