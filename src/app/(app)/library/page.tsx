import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  MEDIA_ICONS,
  MEDIA_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
  stars,
} from "@/lib/display";
import { MEDIA_TYPES, ENTRY_STATUSES } from "@/lib/validation";
import type { MediaType, EntryStatus } from "@/generated/prisma/enums";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";

const isMediaType = (v: string): v is MediaType =>
  (MEDIA_TYPES as readonly string[]).includes(v);
const isStatus = (v: string): v is EntryStatus =>
  (ENTRY_STATUSES as readonly string[]).includes(v);

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const typeFilter = sp.type && isMediaType(sp.type) ? sp.type : undefined;
  const statusFilter =
    sp.status && isStatus(sp.status) ? sp.status : undefined;

  const entries = await prisma.entry.findMany({
    where: {
      userId: user.id,
      ...(typeFilter ? { mediaType: typeFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const buildHref = (patch: { type?: string; status?: string }) => {
    const params = new URLSearchParams();
    const type = patch.type ?? typeFilter;
    const status = patch.status ?? statusFilter;
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    const qs = params.toString();
    return qs ? `/library?${qs}` : "/library";
  };

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

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 text-sm">
        <FilterRow
          label="Type"
          allHref={buildHref({ type: "" })}
          allActive={!typeFilter}
          options={MEDIA_TYPES.map((t) => ({
            label: MEDIA_LABELS[t],
            href: buildHref({ type: t }),
            active: typeFilter === t,
          }))}
        />
        <FilterRow
          label="Status"
          allHref={buildHref({ status: "" })}
          allActive={!statusFilter}
          options={ENTRY_STATUSES.map((s) => ({
            label: STATUS_LABELS[s],
            href: buildHref({ status: s }),
            active: statusFilter === s,
          }))}
        />
      </div>

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
                </div>
                <div className="mt-1 text-sm text-neutral-500">
                  {e.creator && <span>{e.creator}</span>}
                  {e.creator && e.genres.length > 0 && <span> · </span>}
                  {e.genres.length > 0 && <span>{e.genres.join(", ")}</span>}
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

function FilterRow({
  label,
  allHref,
  allActive,
  options,
}: {
  label: string;
  allHref: string;
  allActive: boolean;
  options: { label: string; href: string; active: boolean }[];
}) {
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 transition ${
      active
        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
        : "border border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-neutral-400">{label}:</span>
      <Link href={allHref} className={chip(allActive)}>
        All
      </Link>
      {options.map((o) => (
        <Link key={o.href} href={o.href} className={chip(o.active)}>
          {o.label}
        </Link>
      ))}
    </div>
  );
}
