import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getDashboardStats } from "@/lib/stats";
import { DashboardCharts } from "@/components/DashboardCharts";
import { FilterBar } from "@/components/FilterBar";
import { parseEntryFilters } from "@/lib/filters";
import { MEDIA_ICONS, MEDIA_LABELS } from "@/lib/display";
import type { MediaType } from "@/generated/prisma/enums";

const MEDIA: MediaType[] = ["book", "tv", "movie"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = parseEntryFilters(sp);
  const stats = await getDashboardStats(user.id, filters);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link
          href="/library/search"
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
        >
          Add something
        </Link>
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

      {stats.totals.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-neutral-500 dark:border-white/15">
          Your dashboard lights up once you add entries.{" "}
          <Link href="/library/search" className="font-medium underline">
            Add your first
          </Link>
          .
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total entries" value={stats.totals.total} />
            {MEDIA.map((t) => (
              <StatCard
                key={t}
                label={`${MEDIA_LABELS[t]}s`}
                value={stats.totals.byType[t]}
                sub={`${stats.completedByType[t]} completed`}
                icon={MEDIA_ICONS[t]}
              />
            ))}
          </div>

          {/* Pace + average rating */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Avg rating"
              value={stats.averageRating ?? "—"}
              sub="across rated items"
            />
            {stats.pace.map((p) => (
              <StatCard
                key={p.type}
                label={`${MEDIA_LABELS[p.type]} pace`}
                value={p.perMonth}
                sub="completed / month"
                icon={MEDIA_ICONS[p.type]}
              />
            ))}
          </div>

          <DashboardCharts stats={stats} />
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">{label}</span>
        {icon && <span aria-hidden>{icon}</span>}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-neutral-400">{sub}</div>}
    </div>
  );
}
